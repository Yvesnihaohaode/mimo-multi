import { useEffect, useState } from "react";
import { Alert } from "antd";
import { WarningFilled } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { api, type HealthResponse } from "../api/client";

// Polls /admin/api/health every 30s. When the server flips restartRequired=true
// (the data-dir migration just finished), shows a persistent yellow banner with
// the new target dir. The banner clears itself naturally after the user restarts
// the process — the new boot won't have the flag set.
const POLL_MS = 30_000;

export function RestartRequiredBanner() {
  const { t } = useTranslation("dataDir");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function pull(): Promise<void> {
      try {
        const r = await api.health();
        if (!cancelled) setHealth(r);
      } catch {
        // Network blip — keep last-known state. If the user actually killed
        // the server to restart, the next successful poll will read fresh
        // (likely restartRequired=false) state.
      }
    }
    void pull();
    timer = setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
    };
  }, []);

  if (!health?.restartRequired) return null;

  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningFilled />}
      style={{ marginBottom: 12 }}
      message={<strong>{t("banner.title")}</strong>}
      description={t("banner.body", {
        dir: health.restartTargetDir ?? health.dataDir,
      })}
    />
  );
}
