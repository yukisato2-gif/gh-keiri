# GH出納帳 AppSheet完全仕様書

## 1. テーブル定義

### 1.1 Transactions（入出金記録）
| # | カラム名 | 型 | KEY | LABEL | 備考 |
|---|---------|---|-----|-------|------|
| 1 | _RowNumber | Number | | | システム |
| 2 | ID | Text | ✓ | ✓ | 主キー |
| 3 | 拠点 | Ref (Locations) | | | |
| 4 | 日付 | Date | | | |
| 5 | 年月 | Number | | | YYYYMM形式 |
| 6 | 対応種別 | Enum | | | 値: 立替金, 本部入金, おつり, 不明金, 不足金額登録, 過剰金額登録, 利用者預り金, 仮払金 |
| 7 | 摘要カテゴリ | Ref (Abstract) | | | |
| 8 | 金額 | Price | | | |
| 9 | 利用者 | Ref (Users) | | | |
| 10 | 摘要 | Text | | | |
| 11 | 証憑 | Image | | | 写真/画像 |
| 12 | 締めステータス | Enum | | | 値: 未, 済 |
| 13 | 作成日時 | DateTime | | | |
| 14 | 作成者 | Text | | | USEREMAIL() |
| 15 | 更新日時 | DateTime | | | |
| 16 | 更新者 | Text | | | USEREMAIL() |
| 17 | 修正依頼フラグ | YesNo | | | |
| 18 | 修正依頼内容 | Text | | | |
| 19 | 修正依頼者 | Text | | | メールアドレス |
| 20 | 修正依頼日時 | DateTime | | | |
| 21 | 使用金額 | Price | | | |
| 22 | 入金（おつり） | Price | | | |
| 23 | 不明金 | Price | | | |
| 24 | 不明金の理由 | Text | | | |
| vc | vcエリア名 | Virtual | | | LOOKUP([拠点], Locations, エリア) |
| vc | vc利用者名 | Virtual | | | |
| vc | vc利用者名：カレンダー | Virtual | | | カレンダー表示用 |
| vc | vc対応種別色 | Virtual | | | 色分け用 |
| vc | vc締めステータスラベル | Virtual | | | |
| vc | vc金額表示 | Virtual | | | |
| vc | vc修正依頼状態 | Virtual | | | |
| vc | vc入出金タイプ | Virtual | | | 入金/出金の判定 |
| vc | vc残高計算 | Virtual | | | |
| vc | vc摘要表示 | Virtual | | | |
| vc | vc拠点名 | Virtual | | | |

### 1.2 Check（残高チェック）
| # | カラム名 | 型 | 備考 |
|---|---------|---|------|
| 1 | CheckID | Text (KEY) | 主キー |
| 2 | 拠点 | Ref (Locations) | |
| 3 | 日付 | Date | |
| 4 | 一万円札 | Number | 枚数 |
| 5 | 五千円札 | Number | 枚数 |
| 6 | 二千円札 | Number | 枚数 |
| 7 | 千円札 | Number | 枚数 |
| 8 | 五百円玉 | Number | 枚数 |
| 9 | 百円硬貨 | Number | 枚数 |
| 10 | 五十円玉 | Number | 枚数 |
| 11 | 十円硬貨 | Number | 枚数 |
| 12 | 五円硬貨 | Number | 枚数 |
| 13 | 一円硬貨 | Number | 枚数 |
| 14 | 計算合計金額 | Virtual (Price) | 紙幣硬貨の合計額を自動計算 |
| 15 | 記録時残高 | Virtual (Price) | Transactions合計から算出 |
| 16 | 記録時差額 | Virtual (Price) | 計算合計金額 - 記録時残高 |
| 17 | 差額（不足） | Virtual (Price) | 記録時差額 < 0 の場合 |
| 18 | 差額（過剰） | Virtual (Price) | 記録時差額 > 0 の場合 |
| 19 | 残高一致チェック | Virtual (YesNo) | 差額 = 0 なら TRUE |
| 20 | メモ/特記事項 | Text | |
| 21 | 作成日時 | DateTime | |
| 22 | 作成者 | Text | |
| 23 | 更新日時 | DateTime | |
| 24 | 更新者 | Text | |
| 25 | 差額登録済フラグ | YesNo | |

### 1.3 Abstract（摘要マスタ）
| 摘要カテゴリ | 対応種別 |
|-------------|---------|
| 食材費 | 立替金 |
| 日用品費 | 立替金 |
| 医療費 | 立替金 |
| 被服費 | 立替金 |
| 教養娯楽費 | 立替金 |
| 交通費 | 立替金 |
| 嗜好品 | 利用者預り金 |
| 理美容費 | 利用者預り金 |
| その他 | 立替金 |
| 本部入金 | 本部入金 |
| おつり | おつり |
| 不明金 | 不明金 |
| 仮払金 | 仮払金 |
| 不足金額登録 | 不足金額登録 |
| 過剰金額登録 | 過剰金額登録 |
| 電話代立替 | 立替金 |
| 自販機（おやつ） | 立替金 |
| 自販機（飲料） | 利用者預り金 |
| クリーニング | 立替金 |

### 1.4 Locations（拠点マスタ）
| カラム | 型 |
|--------|---|
| 拠点ID | Text (KEY) |
| 拠点 | Text |
| エリア | Ref (Areas) |

### 1.5 Areas（エリアマスタ）
| カラム | 型 |
|--------|---|
| エリアID | Text (KEY) |
| エリア | Text |

### 1.6 Users（利用者マスタ）
IMPORTRANGEでGoogleスプレッドシート「利用者名簿」から取得
| カラム | 型 |
|--------|---|
| 利用者ID | Text (KEY) |
| 利用者 | Text |
| 拠点 | Ref (Locations) |

### 1.7 Employees（従業員マスタ）
| カラム | 型 | 備考 |
|--------|---|------|
| 従業員ID | Text (KEY) | |
| 従業員名 | Text | |
| メールアドレス | Email | ログイン用 |
| 役職 | Enum | 本社管理者, SV, ホーム長 |
| 担当拠点 | Ref (Locations) | |
| 作成日時 | DateTime | |
| 更新日時 | DateTime | |

### 1.8 Authority（権限マスタ）
| カラム | 型 |
|--------|---|
| 権限ID | Text (KEY) |
| 従業員 | Text (メールアドレス) |
| 拠点 | Ref (Locations) |
| 作成日時 | DateTime |
| 作成者 | Text |
| 更新日時 | DateTime |
| 更新者 | Text |

### 1.9 MOU（覚書マスタ）
| カラム | 型 |
|--------|---|
| 覚書ID | Text (KEY) |
| 利用者 | Ref (Users) |
| 拠点 | Ref (Locations) |
| 作成日時 | DateTime |
| 作成者 | Text |
| 更新日時 | DateTime |
| 更新者 | Text |

### 1.10 MonthlyBilling（月次請求集計）
| カラム | 型 |
|--------|---|
| 請求ID | Text (KEY) |
| 利用者 | Ref (Users) |
| 拠点 | Ref (Locations) |
| 対象年月 | Number (YYYYMM) |
| 合計金額 | Price |
| 作成日時 | DateTime |
| 更新日時 | DateTime |

### 1.11 集計結果
| カラム | 型 |
|--------|---|
| 拠点コード | Text |
| 拠点名 | Text |
| 対象月 | Number |
| 対応種別 | Text |
| 取引件数 | Number |
| 合計金額 | Price |

### 1.12 PDF
PDF出力用テーブル（帳票生成用）

---

## 2. Slices（データフィルタリング）

### 2.1 MyBranchTransactions
- **Source**: Transactions
- **ロジック**:
  1. USERSETTINGS("選択拠点") が設定済み → その拠点のみ
  2. 本社管理者 → 全データ表示
  3. その他 → Authority テーブルで自分に紐づく拠点のデータのみ

### 2.2 MyBranchTransactions_Correction
- **Source**: Transactions
- **ロジック**: `修正依頼フラグ = TRUE` AND MyBranchTransactions と同じ拠点制限

### 2.3 MyBranchTransactions_Difference
- **Source**: Transactions
- **ロジック**: `対応種別 IN ("不足金額登録", "過剰金額登録")` AND 同じ拠点制限

### 2.4 Check, Authority, Locations, MonthlyBilling, Users, Valuables
各テーブルに1つずつSliceが存在（同様の拠点ベースフィルタリング）

---

## 3. Actions（アクション定義）

### 3.1 Transactions Actions (21個)

#### カスタムアクション
| アクション名 | 種類 | 動作 | Position |
|-------------|------|------|----------|
| SV締め | Grouped | _SV締め → _SV - 入出金締めへ移動 | Prominent |
| _SV締め | Data: set values | 締めステータス = "済" | Hide |
| _SV - 入出金締めへ移動 | Navigate | 入出金締めビューへ遷移 | Hide |
| 修正依頼 | Data: set values | 修正依頼フラグ=TRUE, 修正依頼内容=[_INPUT], 修正依頼者=USEREMAIL(), 修正依頼日時=NOW(), 締めステータス="未" | Prominent |
| 修正依頼取消 | Data: set values | 修正依頼フラグ=FALSE, 修正依頼内容="", 修正依頼者="", 修正依頼日時="" | Prominent |
| 修正完了 | Grouped | _修正完了 → _修正依頼一覧へ移動 | Prominent |
| _修正完了 | Data: set values | 修正依頼フラグ=FALSE | Hide |
| _修正依頼一覧へ移動 | Navigate | 修正依頼一覧ビューへ遷移 | Hide |
| 証憑修正 | App: edit this row | 証憑のみ編集フォーム (Open a form) | Prominent |
| CSV出力（入出金記録） | App: export to CSV | locale=Japanese (Japan) | Primary |

#### システム生成アクション
Add, Delete, Edit, Compose Email (更新者/作成者/修正依頼者), View Ref ×5

### 3.2 Check Actions (10個)

#### カスタムアクション
| アクション名 | 種類 | 動作 | Position |
|-------------|------|------|----------|
| 過剰金額登録 | Grouped | _過剰金額登録 → _差額登録済みにする | Prominent |
| _過剰金額登録 | Data: add row to Transactions | 拠点=[拠点], 日付=[日付], 対応種別="過剰金額", 金額=[差額（過剰）], 摘要カテゴリ="", 証憑="", 使用金額="", 入金（おつり）="" | Hide |
| 不足金額登録 | Grouped | _不足金額登録 → _差額登録済みにする | Prominent |
| _不足金額登録 | Data: add row to Transactions | 拠点=[拠点], 日付=[日付], 対応種別="不足金額", 金額=[差額（不足）], ... | Hide |
| _差額登録済みにする | Data: set values | 差額登録済フラグ=TRUE | Hide |

#### システム生成アクション
Add, Delete, Edit, View Ref (vcエリア名/拠点)

---

## 4. Bots/Automations (10個)

### 4.1 Transactions Bots (5)
1. **高額入出金記録(10,000円以上)** - 10,000円以上の入出金登録時にメール通知
2. **通常入出金記録(10,000円未満)** - 10,000円未満の入出金登録時にメール通知
3. **修正依頼通知** - 修正依頼時にホーム長へメール通知
4. **不足/過剰金額登録アラート** - 差額登録時にメール通知
5. **修正完了通知** - 修正完了時に依頼者へメール通知

### 4.2 Check Bots (1)
6. **残高不一致アラート** - 残高チェックで差額が出た場合にメール通知

### 4.3 MonthlyBilling Bots (1)
7. （MonthlyBilling関連の自動処理）

### 4.4 PDF Bots (2)
8-9. PDF帳票生成関連

### 4.5 Users Bots (1)
10. **月次利用者請求集計（自動）** - 毎月1日12:00に自動実行。重複チェック → 請求レコード作成 or 更新

---

## 5. View構成（画面一覧）

### PRIMARY NAVIGATION
- ダッシュボード (dashboard)

### MENU NAVIGATION
1. **SVメニュー**
2. **ホーム長メニュー**
3. **従業員閲覧権限メニュー**
4. **本社管理者 - 請求メニュー** (Show_if条件付き)
5. **本社管理者メニュー** (Show_if条件付き)

### 主要画面
- **入出金記録** - Transactions テーブル, form タイプ, middle
- **入出金一覧確認** - Transactions, table/deck タイプ
- **残高チェック** - Check テーブル
- **SV - 入出金締め** - 締め操作画面
- **修正依頼一覧** - MyBranchTransactions_Correction スライス

### ボトムナビゲーション（アプリプレビューから確認）
- ダッシュボード
- 入出金一覧確認
- 入出金記録
- 残高チェック

---

## 6. セキュリティ/アクセス制御

### Security Filters
- Authorityテーブルを基にした拠点ベースの行レベルフィルタ
- USERSETTINGS("選択拠点") による動的拠点切替

### 役職と権限
| 役職 | 権限 |
|------|------|
| 本社管理者 | 全拠点アクセス、全メニュー表示、管理機能利用可 |
| SV | 担当拠点の入出金管理、締め操作、修正依頼 |
| ホーム長 | 担当拠点の入出金管理、修正完了操作 |

### 認証
- Google アカウント（Workspace）によるログイン
- Employees テーブルのメールアドレスとの紐付け

---

## 7. 業務フロー

### 7.1 入出金記録フロー
1. ホーム長/SVが入出金記録を作成
2. 摘要カテゴリ選択 → 対応種別が自動決定（Abstractマスタ参照）
3. 金額、利用者、証憑（写真）を入力
4. 保存 → Bot通知（金額に応じて高額/通常）

### 7.2 SV締めフロー
1. SVが「SV - 入出金締め」画面で未締めレコードを確認
2. 「SV締め」アクション実行 → 締めステータス="済"に変更
3. 自動で入出金締め画面に戻る

### 7.3 修正依頼フロー
1. SVが締め済みレコードに対して「修正依頼」実行
2. 修正依頼内容を入力（[_INPUT]）
3. 修正依頼フラグ=TRUE, 締めステータス="未"に戻る
4. Bot通知でホーム長に修正依頼が通知される
5. ホーム長がレコードを修正
6. ホーム長が「修正完了」実行 → 修正依頼フラグ=FALSE
7. Bot通知で修正依頼者に完了通知

### 7.4 残高チェックフロー
1. 紙幣・硬貨の枚数を入力
2. 計算合計金額が自動算出
3. 記録時残高（Transactions合計）と比較
4. 差額が出た場合: 過剰金額登録/不足金額登録アクション
5. 差額登録 → Transactionsに自動レコード作成 + 差額登録済フラグ=TRUE

### 7.5 月次請求集計フロー
1. 毎月1日12:00に自動実行
2. Users×拠点の組み合わせで月次請求を集計
3. 重複チェック → 新規作成 or 更新

---

## 8. gh-keiriとの差分（要修正項目）

### 致命的差分（必須修正）
1. **対応種別の値**: gh-keiriは英語enum (cash_advance, hq_deposit等) → 日本語に変更必要
2. **独自追加機能の削除**: 承認ワークフロー(5段階), 前払金管理, 精算管理, 未精算管理, 請求ステータス管理 → すべて削除
3. **締めステータスの値**: "未"/"済" の2値（gh-keiriは "未締め"/"中間締め"/"月末締め" → 修正必要）

### 重要差分
4. **Abstract(摘要)マスタ**: 19エントリすべてを正確に再現
5. **修正依頼フロー**: SV→ホーム長の修正依頼/完了フローを忠実に再現
6. **残高チェック→差額登録**: Check→Transactionsへの自動レコード作成
7. **メニュー構成**: SV/ホーム長/従業員閲覧権限/本社管理者の4メニュー構成
8. **Bot通知**: 高額/通常の金額閾値別通知、修正依頼/完了通知

### 軽微差分
9. CSV出力機能（locale: Japanese）
10. USERSETTINGS("選択拠点") による拠点切替
11. PDF出力機能
