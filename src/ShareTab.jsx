import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Copy, Check, Mail } from "lucide-react";
import { styles } from "./styles";

export default function ShareTab() {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const link = window.location.origin;

  useEffect(() => {
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: "#26312B", light: "#00000000" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [link]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso — o utilizador pode sempre selecionar o texto
    }
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent("ActiveLife — link da app")}&body=${encodeURIComponent(
    `Olá! Aqui está o link da app ActiveLife:\n\n${link}\n\nCria a tua conta para começares a usar.`
  )}`;

  return (
    <div>
      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Partilhar a app</div>
        <p style={styles.planObsText}>
          Envia este link a quem quiseres que use a app. Cada pessoa cria a
          sua própria conta e só vê o seu plano.
        </p>

        <div style={{ ...styles.rowGap, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ ...styles.obsInput, flex: 1, minWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {link}
          </span>
          <button style={styles.smallBtnPrimary} onClick={copyLink}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
          </button>
        </div>

        <a href={mailtoHref} style={{ textDecoration: "none" }}>
          <button style={{ ...styles.smallBtn, marginTop: 10 }}>
            <Mail size={13} /> Enviar por email
          </button>
        </a>
      </div>

      <div style={{ ...styles.planObsBox, textAlign: "center" }}>
        <div style={styles.planObsTitle}>Código QR</div>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR code do link da app" style={{ width: 220, height: 220, margin: "0 auto", display: "block" }} />
        ) : (
          <p style={styles.emptyMeal}>A gerar código…</p>
        )}
        <p style={{ ...styles.planObsText, marginTop: 10 }}>Aponta a câmara do telemóvel para abrir o link.</p>
      </div>
    </div>
  );
}
