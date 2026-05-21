import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Descriptions,
  Input,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseOutlined,
  InfoCircleOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import {
  api,
  ApiError,
  type DataDirInfo,
  type DataDirPreview,
  type MigrationStreamEntry,
} from "../api/client";

type Phase =
  | "viewing"
  | "form"
  | "previewing"
  | "previewed"
  | "running"
  | "done"
  | "error";

interface RunState {
  fileCount: number;
  totalBytes: number;
  copiedFiles: number;
  copiedBytes: number;
  currentFile: string;
  destDir: string | null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function DataDirManager({
  onMigrationDone,
}: {
  onMigrationDone?: () => void;
}) {
  const { t } = useTranslation("dataDir");
  const { message } = AntdApp.useApp();

  const [info, setInfo] = useState<DataDirInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("viewing");
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<DataDirPreview | null>(null);
  const [run, setRun] = useState<RunState>({
    fileCount: 0,
    totalBytes: 0,
    copiedFiles: 0,
    copiedBytes: 0,
    currentFile: "",
    destDir: null,
  });
  const [errorInfo, setErrorInfo] = useState<{ code: string; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .dataDirInfo()
      .then((r) => {
        if (!cancelled) setInfo(r);
      })
      .catch((err: Error) => {
        if (!cancelled) message.error(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [message]);

  useEffect(
    () => () => {
      // Abort the SSE if the component unmounts mid-migration.
      abortRef.current?.abort();
    },
    [],
  );

  async function doPreview() {
    setPhase("previewing");
    setPreview(null);
    try {
      const r = await api.dataDirPreview(target);
      setPreview(r);
      setPhase("previewed");
    } catch (err) {
      message.error((err as ApiError).message);
      setPhase("form");
    }
  }

  async function startMigration() {
    if (!preview || !preview.ok) return;
    setPhase("running");
    setRun((prev) => ({ ...prev, destDir: preview.resolved }));
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await consumeMigrationStream(target, ac.signal, (evt) => {
        if (evt.type === "scan") {
          setRun((r) => ({ ...r, fileCount: evt.fileCount, totalBytes: evt.totalBytes }));
        } else if (evt.type === "progress") {
          setRun((r) => ({
            ...r,
            fileCount: evt.totalFiles,
            totalBytes: evt.totalBytes,
            copiedFiles: evt.copiedFiles,
            copiedBytes: evt.copiedBytes,
            currentFile: evt.currentFile,
          }));
        } else if (evt.type === "done") {
          setRun((r) => ({ ...r, destDir: evt.destDir }));
          setPhase("done");
          onMigrationDone?.();
        } else if (evt.type === "error") {
          setErrorInfo({ code: evt.code, message: evt.message });
          setPhase("error");
        }
      });
    } catch (err) {
      setErrorInfo({ code: "network_error", message: (err as Error).message });
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  }

  function reset() {
    setPhase("viewing");
    setTarget("");
    setPreview(null);
    setErrorInfo(null);
    setRun({
      fileCount: 0,
      totalBytes: 0,
      copiedFiles: 0,
      copiedBytes: 0,
      currentFile: "",
      destDir: null,
    });
  }

  if (loading || !info) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <Spin />
      </div>
    );
  }

  const sourceTag = (
    <Tag color={info.source === "default" ? "default" : "blue"}>
      {t(`source.${info.source}`)}
    </Tag>
  );

  return (
    <div>
      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label={t("currentLabel")}>
          <Typography.Text code copyable={{ text: info.current }}>
            {info.current}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("source.label")}>{sourceTag}</Descriptions.Item>
        <Descriptions.Item label={t("pointerPath")}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            <code>{info.pointerPath}</code>
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>

      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}
      >
        {info.editable ? t("editableHint") : t("lockedHint")}
        <br />
        {t("pointerHint", { path: info.pointerPath })}
      </Typography.Paragraph>

      {/* ── viewing → form ─────────────────────────────────────────────── */}
      {phase === "viewing" && info.editable && (
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          style={{ marginTop: 16 }}
          onClick={() => setPhase("form")}
        >
          {t("migrateBtn")}
        </Button>
      )}

      {/* ── form: enter path + validate ────────────────────────────────── */}
      {(phase === "form" || phase === "previewing" || phase === "previewed") && (
        <div style={{ marginTop: 18 }}>
          <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
            {t("form.label")}
          </Typography.Text>
          <Input
            value={target}
            placeholder={t("form.placeholder")}
            onChange={(e) => {
              setTarget(e.target.value);
              if (phase === "previewed") setPhase("form");
              setPreview(null);
            }}
            disabled={phase === "previewing"}
            allowClear
          />
          <Space style={{ marginTop: 10 }} wrap>
            <Button
              type="primary"
              onClick={doPreview}
              loading={phase === "previewing"}
              disabled={!target.trim()}
            >
              {phase === "previewing" ? t("form.validating") : t("form.validateBtn")}
            </Button>
            <Button icon={<CloseOutlined />} onClick={reset}>
              {t("form.cancelBtn")}
            </Button>
          </Space>

          {preview && (
            <div style={{ marginTop: 14 }}>
              {preview.errors.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 10 }}
                  message={t("preview.errors")}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {preview.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  }
                />
              )}
              {preview.warnings.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningFilled />}
                  style={{ marginBottom: 10 }}
                  message={t("preview.warnings")}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {preview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  }
                />
              )}
              {preview.ok && (
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label={t("preview.fileCount")}>
                    {preview.fileCount}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("preview.totalBytes")}>
                    {formatBytes(preview.totalBytes)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("preview.targetExists")}>
                    {preview.targetExists ? (
                      <Tag color="default">yes</Tag>
                    ) : (
                      <Tag color="blue">no (will be created)</Tag>
                    )}
                  </Descriptions.Item>
                  {preview.targetExists && (
                    <Descriptions.Item label={t("preview.targetEmpty")}>
                      {preview.targetEmpty ? (
                        <Tag color="green">yes</Tag>
                      ) : (
                        <Tag color="red">no</Tag>
                      )}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              )}
              {preview.ok && (
                <Alert
                  style={{ marginTop: 10 }}
                  type="warning"
                  icon={<InfoCircleOutlined />}
                  showIcon
                  message={t("running.warning")}
                />
              )}
              {preview.ok && (
                <Button
                  type="primary"
                  danger
                  size="large"
                  style={{ marginTop: 14 }}
                  onClick={startMigration}
                >
                  {t("form.startBtn")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── running: progress ──────────────────────────────────────────── */}
      {phase === "running" && (
        <div style={{ marginTop: 18 }}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t("running.title")}
          </Typography.Title>
          <Progress
            percent={
              run.totalBytes > 0
                ? Math.min(100, Math.round((run.copiedBytes / run.totalBytes) * 100))
                : 0
            }
            status="active"
            format={(p) =>
              run.totalBytes > 0
                ? `${p}% · ${formatBytes(run.copiedBytes)} / ${formatBytes(run.totalBytes)}`
                : t("running.phaseScan")
            }
          />
          <Typography.Paragraph
            type="secondary"
            style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}
          >
            {run.fileCount > 0
              ? t("running.phaseCopy", { copied: run.copiedFiles, total: run.fileCount })
              : t("running.phaseScan")}
          </Typography.Paragraph>
          {run.currentFile && (
            <Typography.Paragraph
              type="secondary"
              style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}
            >
              {t("running.currentFile")}: <code>{run.currentFile}</code>
            </Typography.Paragraph>
          )}
          <Alert
            type="warning"
            showIcon
            icon={<WarningFilled />}
            style={{ marginTop: 12 }}
            message={t("running.warning")}
          />
        </div>
      )}

      {/* ── done ───────────────────────────────────────────────────────── */}
      {phase === "done" && (
        <Alert
          style={{ marginTop: 18 }}
          type="success"
          icon={<CheckCircleFilled />}
          showIcon
          message={t("done.title")}
          description={t("done.body", { dir: run.destDir ?? target })}
        />
      )}

      {/* ── error ──────────────────────────────────────────────────────── */}
      {phase === "error" && errorInfo && (
        <>
          <Alert
            style={{ marginTop: 18 }}
            type="error"
            showIcon
            message={t("error.title")}
            description={
              <>
                <div>
                  <strong>code:</strong> <code>{errorInfo.code}</code>
                </div>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {errorInfo.message}
                </div>
              </>
            }
          />
          <Button style={{ marginTop: 10 }} onClick={reset}>
            {t("error.retryBtn")}
          </Button>
        </>
      )}
    </div>
  );
}

// ── SSE consumer (POST stream) ─────────────────────────────────────────
// Mirrors the parser used in UpdateModal.tsx — kept local rather than shared
// because the event payload shape differs and we don't want a generic SSE
// abstraction creeping in this early.
async function consumeMigrationStream(
  targetDir: string,
  signal: AbortSignal,
  onEntry: (e: MigrationStreamEntry) => void,
): Promise<void> {
  const res = await fetch(api.dataDirMigrateStreamUrl(), {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({ targetDir }),
    credentials: "same-origin",
    signal,
  });
  if (!res.ok || !res.body) {
    onEntry({
      type: "error",
      code: `http_${res.status}`,
      message: `HTTP ${res.status}`,
    });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const headers = frame.split(/\r?\n/);
      let dataJson = "";
      for (const h of headers) {
        if (h.startsWith("data:")) dataJson += h.slice(5).trim();
      }
      if (!dataJson) continue;
      try {
        onEntry(JSON.parse(dataJson) as MigrationStreamEntry);
      } catch {
        /* skip malformed */
      }
    }
  }
}
