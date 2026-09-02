import { styles } from "./styles";

export const APP_VERSION = "1.1.0";

export default function AboutTab() {
  return (
    <div style={styles.planObsBox}>
      <div style={styles.planObsTitle}>Sobre a app</div>
      <p style={styles.planObsText}>
        <strong>Plano Alimentar</strong><br />
        Versão {APP_VERSION}
      </p>
      <p style={{ ...styles.planObsText, marginTop: 10 }}>
        Aplicação pessoal para gerir planos alimentares — refeições, opções e
        ingredientes, com uma conta própria para cada pessoa. Feita à medida,
        e vai continuar a evoluir com novas funcionalidades ao longo do tempo.
      </p>
    </div>
  );
}
