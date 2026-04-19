import { useEffect } from "react";
import { GITHUB_RELEASES_URL, portableExeAssetUrl } from "../downloadUrls";
import { GAME_VERSION_LABEL, DESKTOP_EXE_VERSION } from "../version";

interface DownloadPageProps {
  onBack: () => void;
}

export function DownloadPage({ onBack }: DownloadPageProps) {
  const exeUrl = portableExeAssetUrl();

  useEffect(() => {
    const prev = document.title;
    document.title = "Download — Monster Slayer";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="download-page" role="document" aria-label="Download Windows app">
      <div className="download-page-inner">
        <p className="download-page-eyebrow">Desktop</p>
        <h1 className="download-page-title">Monster Slayer for Windows</h1>
        <p className="download-page-lead">
          Play in a portable app — no installer. Your save still lives in this folder; use{" "}
          <strong>transfer lines</strong> from the web game to move heroes between devices.
        </p>

        <div className="download-page-card">
          <p className="download-page-meta">
            <span className="download-page-meta-label">Web build</span> {GAME_VERSION_LABEL}
            <span className="download-page-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="download-page-meta-label">Windows portable</span> v{DESKTOP_EXE_VERSION}
          </p>
          <a className="download-page-primary" href={exeUrl} rel="noopener noreferrer">
            Download MonsterSlayer-{DESKTOP_EXE_VERSION}-Portable.exe
          </a>
          <p className="download-page-hint">
            If Windows SmartScreen appears, choose <strong>More info</strong> → <strong>Run anyway</strong> — the file
            is not signed yet.
          </p>
        </div>

        <p className="download-page-secondary">
          <a href={GITHUB_RELEASES_URL} target="_blank" rel="noopener noreferrer">
            All releases on GitHub
          </a>{" "}
          — changelog and older builds.
        </p>

        <button type="button" className="download-page-back title-screen-secondary" onClick={onBack}>
          ← Back to game
        </button>
      </div>
    </div>
  );
}
