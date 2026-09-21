# 判断の記録: 20260918-web-terminal-multiplexer/01-server-core

## デバッグ D1: logic / retry（review round 1・2026-09-19T07:36:48Z）
- 根本原因: ブラウザからサーバへの到達経路（どのアドレス・ポート・名前で届き、どの Host/Origin を送り、証明書のどの名前と照合されるか）のモデルが design に無く、表示と許可リストを『サーバ自身の I/F のアドレス＋待ち受けポート』だけから作っていた。WSL2 NAT＋portproxy・Tailscale・リバースプロキシ・仮想ブリッジでこの前提が崩れる。二次原因として、起動順（token 作成→復元→poller→bind）が取り消せない副作用を bind より前に置いていた
- 修正方針: F1 design/architecture/D102 に到達経路のモデルと新しい起動順を書く; F2 --origin を開ける URL として先頭に表示; F3 docs の WSL2 NAT 手順に --port/--origin/SAN; F4 Origin 拒否を warn でログ; F5 bind→token→restore→poller→/ws 受付の順にする; F6 待ち受け失敗の文言; F7 仮想ブリッジを表示から除く; F8 unbracketHost に統合
- 確認方法: pnpm -s typecheck/lint/test/build/smoke と e2e（--workers=1）、実物の CLI で初回起動の待ち受け失敗→再起動で token 表示・--origin の表示・portproxy を模した Host/Origin で 403 とログ
- 確度: high
- 次の行動: retry
