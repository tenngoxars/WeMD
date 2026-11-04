// 仅测试构建启用（cargo feature `automation`）：本机 127.0.0.1:9333 每行接收一个 JSON 字符串形式的 JS 表达式，
// 在主窗口执行后回传一行 JSON（{"ok":值} 或 {"err":信息}）。Linux 的 WebKitGTK 没有可用的 WebDriver，原型验证靠它驱动。
use serde::Deserialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Listener, Manager};

#[derive(Deserialize)]
struct Reply {
    id: u64,
    value: String,
}

pub fn start(app: AppHandle) {
    let pending: Arc<Mutex<HashMap<u64, mpsc::Sender<String>>>> = Arc::default();
    let waiting = pending.clone();
    app.listen_any("automation-reply", move |event| {
        if let Ok(reply) = serde_json::from_str::<Reply>(event.payload()) {
            if let Some(tx) = waiting.lock().unwrap().remove(&reply.id) {
                let _ = tx.send(reply.value);
            }
        }
    });
    std::thread::spawn(move || {
        let listener = TcpListener::bind("127.0.0.1:9333").expect("automation 端口被占用");
        let mut next = 0u64;
        for stream in listener.incoming().flatten() {
            let Ok(read_half) = stream.try_clone() else {
                continue;
            };
            let mut writer = stream;
            for line in BufReader::new(read_half).lines().map_while(Result::ok) {
                next += 1;
                let (tx, rx) = mpsc::channel();
                pending.lock().unwrap().insert(next, tx);
                let script = format!(
                    "(async () => {{ let v; try {{ v = {{ ok: await (0, eval)({line}) }}; }} catch (e) {{ v = {{ err: String(e) }}; }} \
                     window.__TAURI__.event.emit('automation-reply', {{ id: {next}, value: JSON.stringify(v) }}); }})()"
                );
                let evaluated = app
                    .get_webview_window("main")
                    .map(|w| w.eval(&script).is_ok());
                let reply = match evaluated {
                    Some(true) => rx
                        .recv_timeout(Duration::from_secs(90))
                        .unwrap_or_else(|_| r#"{"err":"timeout"}"#.into()),
                    _ => r#"{"err":"no window"}"#.into(),
                };
                if writeln!(writer, "{reply}").is_err() {
                    break;
                }
            }
        }
    });
}
