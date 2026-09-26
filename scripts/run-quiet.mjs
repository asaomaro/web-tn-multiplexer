#!/usr/bin/env node
// pnpm -s <script> は `-r` で複数パッケージを対象にすると、失敗時も含めて子プロセスの
// 出力を丸ごと黙らせる（pnpm 9.15 の既知の挙動。終了コードだけが変わる）。
// `-s` で呼ばれたときだけ出力を一旦バッファし、失敗したときにまとめて吐き出す。成功時は
// 静かなまま。`-s` 無しのときは何も変えず素通しする（途中経過・警告はそのまま流れる）。
//
// `-s` の判定と、バッファ時に子の環境から外す変数:
// - `npm_config_reporter`: pnpm run が `-s` 時に `silent` を入れて子へ渡す（実測）。継承した
//   まま下で pnpm を spawn すると、その pnpm も silent になり、捕まえたい出力が子から出てこない
//   （同じ症状が1段深いところで再発する）。
// - `npm_config_loglevel`: 実測では渡っていなかったが、`--silent` が loglevel の別名でもあるため
//   念のため外す（無いキーの delete は何もしない）。
import { spawn } from "node:child_process";

const command = process.argv[2];
if (command === undefined || command === "") {
  process.stderr.write(
    'run-quiet: 実行するコマンド文字列を1つ渡してください。使い方: node scripts/run-quiet.mjs "<command>"\n',
  );
  process.exit(64);
}

const quiet = process.env.npm_config_reporter === "silent";

if (!quiet) {
  const child = spawn(command, { shell: true, stdio: "inherit" });
  child.on("error", (err) => {
    process.stderr.write(`run-quiet: コマンドの起動に失敗しました: ${err.message}\n`, () => {
      process.exit(1);
    });
  });
  child.on("close", (code) => process.exit(code ?? 1));
} else {
  const childEnv = { ...process.env };
  delete childEnv.npm_config_reporter;
  delete childEnv.npm_config_loglevel;

  const chunks = [];
  const child = spawn(command, { shell: true, stdio: ["inherit", "pipe", "pipe"], env: childEnv });

  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.stderr.on("data", (chunk) => chunks.push(chunk));

  child.on("error", (err) => {
    process.stderr.write(`run-quiet: コマンドの起動に失敗しました: ${err.message}\n`, () => {
      process.exit(1);
    });
  });

  child.on("close", (code, signal) => {
    if (code === 0) {
      process.exit(0);
      return;
    }
    // パイプへの write は非同期になりうるので、コールバックを待ってから exit する
    // （待たずに exit すると出力が途中で切れる可能性がある）。
    const body = Buffer.concat([
      Buffer.from(`run-quiet: 失敗しました（exit ${code ?? "null"}）。捕捉した出力:\n`),
      Buffer.concat(chunks),
    ]);
    process.stdout.write(body, () => {
      if (signal !== null) {
        process.stderr.write(`run-quiet: シグナル ${signal} で終了しました\n`, () => {
          process.exit(code ?? 1);
        });
        return;
      }
      process.exit(code ?? 1);
    });
  });
}
