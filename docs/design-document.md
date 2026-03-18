# GH出納帳 システム設計書

**バージョン**: 1.0
**作成日**: 2026-03-08
**システム名**: GH出納帳 - グループホーム小口現金管理システム
**組織名**: 天日福祉会

---

## 目次

1. [システム概要](#1-システム概要)
2. [技術スタック](#2-技術スタック)
3. [システムアーキテクチャ](#3-システムアーキテクチャ)
4. [データベース設計](#4-データベース設計)
5. [認証・認可設計](#5-認証認可設計)
6. [画面設計](#6-画面設計)
7. [コンポーネント設計](#7-コンポーネント設計)
8. [状態管理設計](#8-状態管理設計)
9. [データフック設計](#9-データフック設計)
10. [ファイルストレージ設計](#10-ファイルストレージ設計)
11. [通知・リアルタイム設計](#11-通知リアルタイム設計)
12. [監査ログ設計](#12-監査ログ設計)
13. [PWA設計](#13-pwa設計)
14. [ビルド・デプロイ設計](#14-ビルドデプロイ設計)
15. [セキュリティ設計](#15-セキュリティ設計)

---

## 1. システム概要

### 1.1 目的

グループホーム（障害者福祉施設）における小口現金の入出金管理を、紙の出納帳からデジタル化し、複数拠点にまたがるリアルタイムな現金管理・承認ワークフロー・監査証跡を実現する。

### 1.2 旧システムからの移行

| 項目 | 旧システム | 新システム |
|------|-----------|-----------|
| 基盤 | Google AppSheet | React SPA + Supabase |
| DB | Google Sheets | PostgreSQL (Supabase) |
| 認証 | Google Workspace | Supabase Auth (Google OAuth) |
| ストレージ | Google Drive | Supabase Storage |
| 通知 | なし | Supabase Realtime |
| 監査 | なし | PostgreSQLトリガー |
| オフライン | 非対応 | PWA (Service Worker) |

### 1.3 主要機能

| 機能 | 説明 |
|------|------|
| 入出金管理 | 取引記録のCRUD、レシート画像添付 |
| 承認ワークフロー | 下書き → 承認待ち → 承認/差戻し |
| 残高チェック | 金種別実査と帳簿残高の照合 |
| 差額調整 | 残高不一致時の自動調整取引生成 |
| 利用者管理 | 入居者マスタの管理、取引への紐付け |
| 月次レポート | 拠点別の収支サマリー・取引一覧 |
| リアルタイム通知 | 承認依頼・承認結果のプッシュ通知 |
| 監査ログ | 全データ変更の完全な履歴追跡 |
| 従業員権限管理 | 拠点別の閲覧・書込・承認権限制御 |
| ダッシュボード | カレンダー表示、サマリー、アラート |

### 1.4 対象ユーザー

| ロール | 日本語名 | 主な操作 |
|--------|---------|---------|
| `hq_admin` | 本社管理者 | 全機能アクセス、マスタ管理、全拠点閲覧 |
| `section_chief` | 課長 | 全拠点閲覧、承認、レポート確認 |
| `supervisor` | 主任 | 担当拠点の承認、取引管理 |
| `home_manager` | ホーム長 | 担当拠点の取引入力・残高チェック |

---

## 2. 技術スタック

### 2.1 フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 19.2.0 | UIフレームワーク |
| TypeScript | 5.9.3 | 型安全な開発 |
| Vite | 7.3.1 | ビルドツール・開発サーバー |
| React Router | 7.13.1 | SPA ルーティング |
| Zustand | 5.0.11 | 状態管理 |
| Tailwind CSS | 4.2.1 | ユーティリティファーストCSS |
| Lucide React | 0.577.0 | アイコンライブラリ |
| date-fns | 4.1.0 | 日付処理 |
| vite-plugin-pwa | 1.2.0 | PWA対応 |

### 2.2 バックエンド (BaaS)

| 技術 | 用途 |
|------|------|
| Supabase | PostgreSQL DB / Auth / Storage / Realtime |
| PostgreSQL | リレーショナルデータベース |
| Row Level Security (RLS) | データアクセス制御 |
| Supabase Auth | Google OAuth 2.0 認証 |
| Supabase Storage | レシート画像保存 |
| Supabase Realtime | 通知のリアルタイム配信 |

### 2.3 開発ツール

| ツール | 用途 |
|--------|------|
| ESLint | コード品質チェック |
| @vitejs/plugin-react | React Fast Refresh |
| @tailwindcss/vite | Tailwind CSS v4 ビルド統合 |

---

## 3. システムアーキテクチャ

### 3.1 全体構成図

```
┌──────────────────────────────────────────────────────┐
│                   クライアント (PWA)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  React   │  │ Zustand  │  │  Router  │            │
│  │  Pages   │  │  Stores  │  │  v7      │            │
│  └────┬─────┘  └────┬─────┘  └──────────┘            │
│       │              │                                │
│  ┌────┴──────────────┴─────┐                          │
│  │     useAppData Hooks    │  ← デュアルモードデータ層  │
│  │  (Supabase / DemoStore) │                          │
│  └────┬──────────────┬─────┘                          │
│       │              │                                │
│  ┌────┴────┐   ┌─────┴────┐                           │
│  │Supabase │   │  Demo    │                           │
│  │ Client  │   │  Store   │                           │
│  └────┬────┘   └──────────┘                           │
└───────┼──────────────────────────────────────────────┘
        │ HTTPS
┌───────┼──────────────────────────────────────────────┐
│       │           Supabase Cloud                      │
│  ┌────┴────┐  ┌──────────┐  ┌──────────┐             │
│  │  Auth   │  │PostgreSQL│  │ Storage  │             │
│  │(Google) │  │  + RLS   │  │(receipts)│             │
│  └─────────┘  └────┬─────┘  └──────────┘             │
│                     │                                 │
│              ┌──────┴──────┐                          │
│              │  Realtime   │                          │
│              │ (通知配信)  │                           │
│              └─────────────┘                          │
└───────────────────────────────────────────────────────┘
```

### 3.2 デュアルモードアーキテクチャ

本システムは **Supabaseモード** と **デモモード** の二重運用に対応する。

```typescript
// モード判定ロジック
function isSupabaseMode(): boolean {
  return supabase !== null && useAuthStore.getState().session !== null
}
```

| モード | 条件 | データソース |
|--------|------|-------------|
| Supabaseモード | 環境変数設定 + ログイン済み | PostgreSQL (Supabase API) |
| デモモード | 環境変数未設定 or 未ログイン | Zustand デモストア |

### 3.3 ディレクトリ構成

```
src/
├── components/          # 再利用可能UIコンポーネント
│   ├── auth/            #   認証関連 (AuthGuard, LoginPage)
│   ├── layout/          #   レイアウト (AppShell, Header, Sidebar, BottomNav)
│   ├── notifications/   #   通知 (NotificationBell)
│   └── shared/          #   共通UI (Calendar, CurrencyDisplay, etc.)
├── hooks/               # カスタムフック
│   ├── useAppData.ts    #   全データ操作フック (25種)
│   └── useAuth.ts       #   認証フック
├── lib/                 # ユーティリティ
│   ├── constants.ts     #   定数定義
│   ├── formatters.ts    #   日付・通貨フォーマッタ
│   ├── storage.ts       #   ファイルストレージ操作
│   ├── supabase.ts      #   Supabaseクライアント初期化
│   └── utils.ts         #   汎用ユーティリティ (cn)
├── pages/               # ページコンポーネント (9画面)
├── routes/              # ルーティング定義
│   └── index.tsx        #   React Router設定
├── stores/              # Zustand状態管理
│   ├── authStore.ts     #   認証状態
│   ├── demoStore.ts     #   デモデータ + アクション
│   └── locationStore.ts #   拠点選択状態
├── types/               # TypeScript型定義
│   └── database.ts      #   全エンティティ型
├── index.css            # Tailwind CSS テーマ定義
├── main.tsx             # アプリケーションエントリポイント
└── App.tsx              # ルートコンポーネント
```

---

## 4. データベース設計

### 4.1 ER図 (テーブル関連図)

```
areas ─────┐
           │1:N
locations ─┤─── employees (primary_location_id)
     │     │         │
     │     │    employee_location_authority
     │     │
     │     └── residents
     │
     ├── transactions ──── categories
     │         │
     │         └── resident_id (FK → residents)
     │
     └── cash_checks

notifications (recipient_id → employees)
audit_logs   (changed_by → employees)
system_config
```

### 4.2 テーブル定義

#### areas（エリアマスタ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | エリアID |
| name | TEXT | NOT NULL, UNIQUE | エリア名 |
| code | TEXT | NOT NULL, UNIQUE | エリアコード |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | 更新日時 |

#### locations（拠点マスタ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 拠点ID |
| name | TEXT | NOT NULL | 拠点名 |
| code | TEXT | NOT NULL, UNIQUE | 拠点コード |
| area_id | UUID | NOT NULL, FK → areas | 所属エリア |
| address | TEXT | | 住所 |
| phone | TEXT | | 電話番号 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 有効フラグ |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |

#### employees（従業員マスタ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 従業員ID |
| auth_user_id | UUID | UNIQUE, FK → auth.users | Supabase認証ユーザーID |
| employee_code | TEXT | NOT NULL, UNIQUE | 従業員コード |
| name | TEXT | NOT NULL | 氏名 |
| email | TEXT | NOT NULL, UNIQUE | メールアドレス |
| role | user_role | NOT NULL, DEFAULT 'home_manager' | ロール |
| primary_location_id | UUID | FK → locations | 主要拠点 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 有効フラグ |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |

#### employee_location_authority（拠点別権限）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 権限ID |
| employee_id | UUID | NOT NULL, FK → employees (CASCADE) | 従業員 |
| location_id | UUID | NOT NULL, FK → locations (CASCADE) | 拠点 |
| can_read | BOOLEAN | NOT NULL, DEFAULT true | 閲覧権限 |
| can_write | BOOLEAN | NOT NULL, DEFAULT false | 書込権限 |
| can_approve | BOOLEAN | NOT NULL, DEFAULT false | 承認権限 |
| granted_by | UUID | FK → employees | 付与者 |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| | | UNIQUE(employee_id, location_id) | 複合ユニーク |

#### residents（利用者/入居者マスタ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 利用者ID |
| location_id | UUID | NOT NULL, FK → locations | 所属拠点 |
| name | TEXT | NOT NULL | 氏名 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 有効フラグ |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |

#### categories（摘要カテゴリマスタ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | カテゴリID |
| name | TEXT | NOT NULL | カテゴリ名 |
| code | TEXT | NOT NULL, UNIQUE | カテゴリコード |
| transaction_type | transaction_type | NOT NULL | 対応取引種別 |
| income_expense | income_expense_type | NOT NULL | 入金/出金区分 |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 有効フラグ |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | 表示順 |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |

#### transactions（入出金記録）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 取引ID |
| location_id | UUID | NOT NULL, FK → locations | 拠点 |
| transaction_date | DATE | NOT NULL, CHECK (当日～90日前) | 取引日 |
| transaction_type | transaction_type | NOT NULL | 取引種別 |
| income_expense | income_expense_type | NOT NULL | 入出金区分 |
| category_id | UUID | NOT NULL, FK → categories | カテゴリ |
| resident_id | UUID | FK → residents | 利用者（任意） |
| description | TEXT | NOT NULL | 摘要・内容 |
| amount | INTEGER | NOT NULL, CHECK (> 0) | 金額（円） |
| receipt_image_path | TEXT | | レシート画像パス |
| notes | TEXT | | メモ |
| recorded_by | UUID | NOT NULL, FK → employees | 記録者 |
| approval_status | approval_status | NOT NULL, DEFAULT 'draft' | 承認ステータス |
| approved_by | UUID | FK → employees | 承認者 |
| approved_at | TIMESTAMPTZ | | 承認日時 |
| rejection_reason | TEXT | | 差戻し理由 |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |

#### cash_checks（残高チェック）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | チェックID |
| location_id | UUID | NOT NULL, FK → locations | 拠点 |
| check_date | DATE | NOT NULL | チェック日 |
| yen_10000〜yen_1 | INTEGER | NOT NULL, DEFAULT 0, CHECK (≥ 0) | 金種別枚数（10種） |
| total_amount | INTEGER | GENERATED STORED | 実査合計金額 |
| expected_balance | INTEGER | | 帳簿残高 |
| difference | INTEGER | GENERATED STORED | 差額 (実査 - 帳簿) |
| checked_by | UUID | NOT NULL, FK → employees | 実施者 |
| notes | TEXT | | メモ |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |
| | | UNIQUE(location_id, check_date) | 1拠点1日1回 |

#### notifications（通知）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 通知ID |
| recipient_id | UUID | NOT NULL, FK → employees | 受信者 |
| type | notification_type | NOT NULL | 通知種別 |
| transaction_id | UUID | FK → transactions | 関連取引 |
| title | TEXT | NOT NULL | タイトル |
| message | TEXT | NOT NULL | メッセージ本文 |
| is_read | BOOLEAN | NOT NULL, DEFAULT false | 既読フラグ |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |

#### audit_logs（監査ログ）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | ログID |
| table_name | TEXT | NOT NULL | 対象テーブル名 |
| record_id | UUID | NOT NULL | 対象レコードID |
| action | audit_action | NOT NULL | 操作種別 (INSERT/UPDATE/DELETE) |
| old_data | JSONB | | 変更前データ |
| new_data | JSONB | | 変更後データ |
| changed_by | UUID | FK → employees | 変更者 |
| created_at | TIMESTAMPTZ | NOT NULL | 変更日時 |

### 4.3 ENUM定義

```sql
CREATE TYPE user_role AS ENUM ('hq_admin', 'section_chief', 'supervisor', 'home_manager');
CREATE TYPE transaction_type AS ENUM ('cash_advance', 'hq_deposit', 'fund_transfer', 'fee', 'shortage_entry', 'surplus_entry');
CREATE TYPE income_expense_type AS ENUM ('income', 'expense');
CREATE TYPE approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'corrected');
```

### 4.4 ヘルパー関数

| 関数名 | 戻り値 | 用途 |
|--------|--------|------|
| `get_current_employee_id()` | UUID | 現在ログイン中の従業員ID取得 |
| `get_current_employee_role()` | user_role | 現在ログイン中の従業員ロール取得 |
| `get_authorized_location_ids()` | SETOF UUID | 閲覧権限のある拠点ID一覧取得 |
| `get_monthly_summary(location_id, year_month)` | TABLE | 月次入出金サマリー |
| `calculate_expected_balance(location_id, as_of_date)` | INTEGER | 指定日時点の帳簿残高計算 |
| `update_residents_updated_at()` | TRIGGER | 利用者テーブルの更新日時自動更新 |

### 4.5 マイグレーション一覧

| ファイル | 内容 |
|---------|------|
| `00001_initial_schema.sql` | 全テーブル・RLS・ヘルパー関数の初期スキーマ |
| `00002_add_rejection_reason.sql` | transactions に rejection_reason カラム追加 |
| `00003_receipt_storage.sql` | Supabase Storage バケット `receipts` 作成 |
| `00004_notifications.sql` | notifications テーブル + RLS + Realtime有効化 |
| `00005_audit_logs.sql` | audit_logs テーブル + INSERT/UPDATE/DELETE トリガー |
| `00006_residents_and_adjustments.sql` | residents テーブル + transactions.resident_id + 不足金/過剰金カテゴリ |

---

## 5. 認証・認可設計

### 5.1 認証フロー

```
ユーザー → Google OAuth 2.0 → Supabase Auth → セッション発行
                                     │
                            employees テーブル照合
                            (auth_user_id = auth.uid())
                                     │
                            EmployeeLocationAuthority 取得
                                     │
                            拠点選択 → アプリ利用開始
```

- 認証プロバイダー: Google OAuth 2.0
- 対象ドメイン: `@amatuhi.co.jp`（組織アカウントのみ）
- セッション管理: Supabase Auth (JWT)

### 5.2 Row Level Security (RLS) ポリシー

全テーブルでRLSが有効化されている。

| テーブル | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| areas | 全員 | admin | admin | admin |
| locations | admin/課長:全件、他:権限拠点 | admin | admin | admin |
| employees | 自分+権限拠点 | admin | admin | admin |
| employee_location_authority | 自分+admin/課長 | admin | admin | admin |
| residents | admin/課長:全件、他:権限拠点 | 書込権限+admin | 書込権限+admin | admin |
| categories | 全員 | admin | admin | admin |
| transactions | admin/課長:全件、他:権限拠点 | 書込権限 | 記録者(下書き)+SV以上 | - |
| cash_checks | admin/課長:全件、他:権限拠点 | 書込権限 | - | - |
| notifications | - | - | - | - |
| system_config | 全員 | admin | admin | admin |

### 5.3 フロントエンド権限制御

| UI要素 | 表示条件 |
|--------|---------|
| 管理メニュー | `role === 'hq_admin' \|\| role === 'section_chief'` |
| 監査ログメニュー | `role !== 'home_manager'` |
| 承認ボタン | `canApprove(locationId)` — ロール + 拠点権限の組合せ |
| 編集ボタン | 記録者本人 かつ 下書きステータス |
| 入出金記録ボタン | ログイン済み全員 |

---

## 6. 画面設計

### 6.1 画面一覧

| # | パス | 画面名 | 説明 |
|---|------|--------|------|
| 1 | `/login` | ログイン | Google OAuth ログイン画面 |
| 2 | `/` | ダッシュボード | カレンダー、サマリー、最近の取引、アラート |
| 3 | `/transactions` | 入出金一覧 | 全取引の検索・フィルタ・一覧表示 |
| 4 | `/transactions/new` | 入出金記録（新規） | 取引の新規登録フォーム |
| 5 | `/transactions/:id` | 取引詳細 | 取引内容・承認操作・レシート閲覧 |
| 6 | `/transactions/:id/edit` | 取引編集 | 取引データの編集フォーム |
| 7 | `/cash-check` | 残高チェック | 金種別実査・チェック履歴・差額調整 |
| 8 | `/reports` | レポート | 月次収支レポート・印刷対応 |
| 9 | `/admin` | 管理設定 | 従業員・拠点・利用者のマスタ管理 |
| 10 | `/audit-log` | 監査ログ | 全操作の変更履歴閲覧 |

### 6.2 レイアウト構成

```
┌────────────────────────────────────────┐
│  Header (ロゴ / 拠点選択 / 通知 / ユーザー) │
├──────────┬─────────────────────────────┤
│ Sidebar  │                             │
│ (PC版)   │       Main Content          │
│          │       (ページ本体)            │
│  ホーム   │                             │
│  入出金   │                             │
│  残高     │                             │
│  レポート  │                             │
│  監査     │                             │
│  管理     │                             │
├──────────┴─────────────────────────────┤
│  BottomNav (モバイル版ナビゲーション)       │
└────────────────────────────────────────┘
```

- **デスクトップ**: 左サイドバー + メインコンテンツ
- **モバイル**: 下部タブナビゲーション + メインコンテンツ

### 6.3 画面詳細

#### 6.3.1 ダッシュボード (`/`)

| セクション | 内容 |
|-----------|------|
| カレンダー | 月間カレンダー、取引日にドットインジケーター、日付クリックで取引表示 |
| 選択日取引 | カレンダーで選んだ日の取引一覧 |
| サマリーカード | 今月入金 / 今月出金 / 現在残高 / 最終チェック日 |
| 承認待ちバナー | 承認権限がある場合、未承認件数を表示 |
| 残高不一致アラート | 最終残高チェックで差額がある場合に警告表示 |
| 最近の入出金 | 直近5件の取引一覧（リンク付き） |

#### 6.3.2 入出金一覧 (`/transactions`)

| 機能 | 説明 |
|------|------|
| 検索 | 摘要テキストでフリーワード検索 |
| ステータスフィルタ | 全て / 下書き / 承認待ち / 承認済み / 差戻し |
| 入出金フィルタ | 全て / 入金のみ / 出金のみ |
| 一覧表示 | 日付、入出金バッジ、ステータスバッジ、摘要、金額 |

#### 6.3.3 入出金記録 (`/transactions/new`, `/transactions/:id/edit`)

| フィールド | 種別 | 必須 |
|-----------|------|------|
| 入出金区分 | 入金 / 出金 トグル | ✅ |
| 日付 | date input (90日前まで) | ✅ |
| 対応種別 | select (transaction_type) | ✅ |
| 摘要カテゴリ | select (categories) | ✅ |
| 利用者 | select (residents, 任意) | |
| 金額 | number input (¥) | ✅ |
| 摘要・内容 | text input | ✅ |
| 証憑 (レシート) | ファイルアップロード / カメラ撮影 | |
| メモ | textarea | |

#### 6.3.4 残高チェック (`/cash-check`)

3タブ構成:

| タブ | 内容 |
|------|------|
| 新規チェック | チェック日入力、金種別枚数入力(10種)、実査合計vs帳簿残高の照合、保存 |
| チェック履歴 | 過去のチェック結果一覧（一致/不一致表示） |
| 差額調整 | 差額ありチェックの一覧、未調整/調整済みバッジ、ワンクリック調整取引生成 |

#### 6.3.5 管理設定 (`/admin`)

3タブ構成（admin/課長のみアクセス可）:

| タブ | 内容 |
|------|------|
| 従業員 | 従業員一覧、編集モーダル（名前/ロール/主要拠点/有効フラグ/拠点別権限） |
| 拠点 | 拠点一覧（名前/コード/エリア/有効フラグ） |
| 利用者 | 拠点フィルター付き利用者一覧、追加/編集モーダル（名前/拠点/有効フラグ） |

---

## 7. コンポーネント設計

### 7.1 共通コンポーネント

| コンポーネント | Props | 用途 |
|--------------|-------|------|
| `CurrencyDisplay` | amount, type?, className?, showSign? | 通貨表示（入金=緑、出金=赤） |
| `StatusBadge` | status, className? | 承認ステータスバッジ |
| `LoadingSpinner` | className?, size? (sm/md/lg) | ローディングスピナー |
| `EmptyState` | icon?, title, description?, action? | 空状態表示 |
| `Calendar` | transactionDates, selectedDate, onDateSelect | 月間カレンダー |

### 7.2 レイアウトコンポーネント

| コンポーネント | 役割 |
|--------------|------|
| `AppShell` | メインレイアウト（AuthGuard内包、Header/Sidebar/BottomNav配置） |
| `Header` | ヘッダー（ロゴ、拠点セレクター、通知ベル、ユーザー名/ロール、ログアウト） |
| `Sidebar` | デスクトップ用ナビゲーション（ロール別メニュー表示制御） |
| `BottomNav` | モバイル用タブナビゲーション（ロール別メニュー表示制御） |

### 7.3 認証コンポーネント

| コンポーネント | 役割 |
|--------------|------|
| `AuthGuard` | 認証状態チェック、未ログイン時リダイレクト、デモモードバイパス |
| `LoginPage` | Google OAuth ログインボタン、組織ドメイン制限表示 |

### 7.4 コード分割戦略

全ページコンポーネントは `React.lazy()` + `Suspense` で遅延読み込みされる。

```typescript
const DashboardPage = lazy(() => import('@/pages/DashboardPage')
  .then(m => ({ default: m.DashboardPage })))
```

---

## 8. 状態管理設計

### 8.1 ストア構成

```
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   authStore     │   │  locationStore   │   │   demoStore      │
│                 │   │                  │   │                  │
│ employee: null  │   │ selectedLocation │   │ areas[]          │
│ session: null   │   │ authorizedLocs[] │   │ locations[]      │
│ isLoading: true │   │                  │   │ employees[]      │
│                 │   │ persist: LS      │   │ transactions[]   │
│ setEmployee()   │   │ (selectedのみ)    │   │ cashChecks[]     │
│ setSession()    │   │                  │   │ notifications[]  │
│ setLoading()    │   │ setSelected()    │   │ residents[]      │
└─────────────────┘   │ setAuthorized()  │   │ authorities[]    │
                      └──────────────────┘   │ auditLogs[]      │
                                             │                  │
                                             │ addTransaction() │
                                             │ updateTx()       │
                                             │ deleteTx()       │
                                             │ addCashCheck()   │
                                             │ addResident()    │
                                             │ ... 11 actions   │
                                             │                  │
                                             │ persist: LS      │
                                             └──────────────────┘
```

### 8.2 永続化設定

| ストア | キー | 永続化対象 |
|--------|------|-----------|
| authStore | なし | 永続化なし（Supabase Session で復元） |
| locationStore | `gh-suitocho-location` | `selectedLocation` のみ |
| demoStore | `gh-suitocho-demo` | 全状態 |

---

## 9. データフック設計

### 9.1 フック一覧（全25種）

#### 読み取りフック（14種）

| フック | 引数 | 戻り値 | Realtime |
|--------|------|--------|----------|
| `useCategories()` | - | `Category[]` | - |
| `useTransactions(locationId)` | locationId | `{ transactions, isLoading, refetch }` | - |
| `useCashChecks(locationId)` | locationId | `{ cashChecks, isLoading, refetch }` | - |
| `useTransaction(id)` | id | `{ transaction, isLoading, refetch }` | - |
| `useResidents(locationId)` | locationId | `{ residents, isLoading, refetch }` | - |
| `useEmployees()` | - | `{ employees, isLoading, refetch }` | - |
| `useLocationAuthorities(empId)` | employeeId | `{ authorities, isLoading, refetch }` | - |
| `useNotifications()` | - | `{ notifications, isLoading, refetch }` | ✅ |
| `useUnreadNotificationCount()` | - | `number` | ✅ |
| `useAuditLogs(recordId?)` | recordId? | `{ logs, isLoading, refetch }` | - |
| `useCurrentLocation()` | - | `{ locationId, locations }` | - |
| `useCurrentEmployee()` | - | `Employee \| null` | - |
| `useCanApprove(locationId)` | locationId | `boolean` | - |
| `usePendingCount(locationId)` | locationId | `number` | - |

#### 書き込みフック（11種）

| フック | 戻り値 |
|--------|--------|
| `useAddTransaction()` | `async (tx) => { error }` |
| `useEditTransaction()` | `async (id, updates) => { error }` |
| `useDeleteTransaction()` | `async (id) => { error }` |
| `useAddCashCheck()` | `async (check) => { error }` |
| `useUpdateTransactionStatus()` | `async (id, action, reason?) => { error }` |
| `useAddResident()` | `async (resident) => { error }` |
| `useEditResident()` | `async (id, updates) => { error }` |
| `useEditEmployee()` | `async (id, updates) => { error }` |
| `useUpdateLocationAuthority()` | `{ upsert, remove }` |
| `useMarkNotificationRead()` | `async (id) => { error }` |
| `useMarkAllNotificationsRead()` | `async () => { error }` |

### 9.2 デュアルモード実装パターン

```typescript
export function useXxx(param) {
  const [data, setData] = useState(initialValue)
  const demoData = useDemoStore((s) => s.xxx)

  const fetchData = useCallback(async () => {
    if (!isSupabaseMode()) {
      // デモモード: Zustandストアから取得
      setData(demoData.filter(...))
      return
    }
    // Supabaseモード: API経由で取得
    const { data, error } = await supabase!.from('table').select('*')...
    setData(data ?? [])
  }, [param, demoData])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}
```

---

## 10. ファイルストレージ設計

### 10.1 構成

- **バケット名**: `receipts`
- **対応形式**: JPEG, PNG, WebP, HEIC
- **最大サイズ**: 5MB
- **パス規則**: `{userId}/{timestamp}_{ランダム文字列}.{拡張子}`

### 10.2 API

| 関数 | 説明 |
|------|------|
| `uploadReceiptImage(file, userId)` | レシート画像アップロード → パス返却 |
| `getReceiptImageUrl(path)` | 署名付きURL取得（有効期限: 1時間） |

---

## 11. 通知・リアルタイム設計

### 11.1 通知種別

| 種別 | トリガー | 受信者 |
|------|---------|--------|
| `approval_request` | 取引が「承認待ち」になった時 | 承認権限を持つ従業員 |
| `approved` | 取引が承認された時 | 記録者 |
| `rejected` | 取引が差戻しされた時 | 記録者 |

### 11.2 リアルタイム配信

- **プロトコル**: Supabase Realtime (WebSocket)
- **チャンネル**: `notifications` テーブルの INSERT / UPDATE イベント
- **フィルター**: `recipient_id = 現在のユーザーID`
- **UI表現**: NotificationBell コンポーネントでバッジ数表示 + ドロップダウン一覧

---

## 12. 監査ログ設計

### 12.1 対象テーブル

PostgreSQLトリガーにより、以下のテーブルの全変更を自動記録:

- transactions
- cash_checks
- employees
- categories
- locations

### 12.2 記録内容

| フィールド | 内容 |
|-----------|------|
| table_name | 変更されたテーブル名 |
| record_id | 変更されたレコードのID |
| action | INSERT / UPDATE / DELETE |
| old_data | 変更前のデータ (JSONB) |
| new_data | 変更後のデータ (JSONB) |
| changed_by | 変更を行った従業員ID |
| created_at | 変更日時 |

---

## 13. PWA設計

### 13.1 設定

| 項目 | 値 |
|------|-----|
| アプリ名 | GH出納帳 - グループホーム小口現金管理 |
| 短縮名 | GH出納帳 |
| テーマカラー | #2563eb (Blue-600) |
| 背景色 | #f8fafc (Slate-50) |
| 表示モード | standalone |
| 更新方式 | autoUpdate |

### 13.2 キャッシュ戦略

| 対象 | 戦略 |
|------|------|
| 静的アセット (JS/CSS/HTML/SVG/PNG/WOFF2) | Precache (ビルド時) |
| Supabase API (`*.supabase.co/*`) | NetworkFirst (最大100件、1時間有効) |

### 13.3 チャンク分割

| チャンク名 | 含むライブラリ |
|-----------|--------------|
| vendor-react | react, react-dom, react-router-dom |
| vendor-supabase | @supabase/supabase-js |
| vendor-zustand | zustand |
| vendor-icons | lucide-react |

---

## 14. ビルド・デプロイ設計

### 14.1 ビルド構成

```bash
# 開発サーバー
npx vite --host          # http://localhost:5173

# プロダクションビルド
npx vite build           # → dist/ ディレクトリ

# 型チェック
npx tsc --noEmit
```

### 14.2 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `VITE_SUPABASE_URL` | ※ | Supabase プロジェクトURL |
| `VITE_SUPABASE_ANON_KEY` | ※ | Supabase 匿名キー |

※ 未設定時はデモモードで動作

### 14.3 ビルド成果物

| ファイル | サイズ (gzip) | 内容 |
|---------|-------------|------|
| index.js | 76.8 KB | アプリケーションコア |
| vendor-supabase.js | 45.7 KB | Supabaseクライアント |
| vendor-react.js | 33.4 KB | React/Router |
| formatters.js | 8.4 KB | date-fns + フォーマッタ |
| index.css | 5.9 KB | Tailwind CSS |
| 他ページ別チャンク | 各1〜4 KB | 遅延読み込みページ |
| **合計** | **約200 KB** | |

---

## 15. セキュリティ設計

### 15.1 認証セキュリティ

| 対策 | 実装 |
|------|------|
| OAuth 2.0 | Google Workspace 組織アカウント限定 |
| JWT | Supabase Auth によるトークン管理 |
| セッション | 自動リフレッシュ (Supabase SDK) |

### 15.2 データアクセス制御

| 対策 | 実装 |
|------|------|
| Row Level Security | 全テーブルにRLSポリシー適用 |
| ロールベース制御 | 4段階ロール (admin/課長/主任/ホーム長) |
| 拠点別権限 | employee_location_authority による細粒度制御 |
| API制限 | Supabase anon key はRLS経由のみアクセス可 |

### 15.3 データ保護

| 対策 | 実装 |
|------|------|
| 通信暗号化 | HTTPS (TLS 1.3) |
| ファイルアクセス | 署名付きURL (1時間有効期限) |
| 取引日制限 | 90日以前の日付は入力不可 (CHECK制約) |
| 金額バリデーション | 正の整数のみ (CHECK制約) |
| 監査証跡 | 全変更をaudit_logsに自動記録 |

### 15.4 フロントエンド対策

| 対策 | 実装 |
|------|------|
| XSS対策 | React の自動エスケープ |
| ルートガード | AuthGuard コンポーネント |
| 管理画面アクセス | ロールチェック (isAdmin) |
| ファイルバリデーション | MIMEタイプ・サイズチェック (5MB) |

---

## 付録

### A. テーマカラー定義

```css
--color-primary: #2563eb          /* メインカラー (Blue-600) */
--color-primary-foreground: #fff  /* メインカラー上のテキスト */
--color-income: #16a34a           /* 入金表示色 (Green-600) */
--color-expense: #dc2626          /* 出金表示色 (Red-600) */
--color-warning: #f59e0b          /* 警告色 (Amber-500) */
--color-background: #f8fafc       /* 背景色 (Slate-50) */
--color-foreground: #0f172a       /* テキスト色 (Slate-900) */
--color-muted: #f1f5f9            /* 控えめ背景 (Slate-100) */
--color-muted-foreground: #64748b /* 控えめテキスト (Slate-500) */
--color-border: #e2e8f0           /* ボーダー色 (Slate-200) */
--color-card: #ffffff             /* カード背景 */
```

### B. 日本語フォントスタック

```css
font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans",
             "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif;
```

### C. 承認ワークフロー状態遷移図

```
  ┌────────┐    提出     ┌─────────┐    承認    ┌─────────┐
  │ draft  │ ──────────→ │ pending │ ────────→ │approved │
  │ 下書き  │            │ 承認待ち │            │ 承認済み │
  └────────┘            └────┬────┘            └─────────┘
       ↑                     │
       │     差戻し           │ 差戻し
       │  ┌──────────────────┘
       │  │
       │  ↓
  ┌─────────┐
  │rejected │   → 修正後 → draft に戻す（revert_to_draft）
  │ 差戻し  │
  └─────────┘
```
