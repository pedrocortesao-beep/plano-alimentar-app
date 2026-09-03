import { styles } from "./styles";

export const APP_VERSION = "1.6.2";

export const CHANGELOG = [
  { version: "1.6.2", notes: "Unidade nunca fica em branco, e mostra equivalência aproximada em gramas (ml, colher, chávena...)." },
  { version: "1.6.1", notes: "Correção: agora dá para mover qualquer item (incluindo os originais) para dentro de um submenu." },
  { version: "1.6.0", notes: "Submenus no menu ⋮ — o administrador pode agrupar itens." },
  { version: "1.5.0", notes: "Administração: ordem do menu, visibilidade por grupo, e nº de alterações visíveis." },
  { version: "1.4.1", notes: "Botão para mostrar/esconder a palavra-passe ao escrevê-la." },
  { version: "1.4.0", notes: "Administradores, tutores (convite e aceitação), e gestão do plano de quem orientas." },
  { version: "1.3.0", notes: "Frase motivadora diária e aviso de nova versão instalada." },
  { version: "1.2.0", notes: "Nome ActiveLife, dados pessoais, e seleção de módulos." },
  { version: "1.1.0", notes: "Sobre, partilhar, lembrete de água, bloqueio do plano, e sugestões." },
  { version: "1.0.0", notes: "Primeira versão: plano alimentar com login próprio para cada pessoa." },
];

export default function AboutTab({ limit }) {
  const visible = CHANGELOG.slice(0, limit || CHANGELOG.length);
  return (
    <div>
      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Sobre a app</div>
        <p style={styles.planObsText}>
          <strong>ActiveLife</strong><br />
          Versão {APP_VERSION}
        </p>
        <p style={{ ...styles.planObsText, marginTop: 10 }}>
          Aplicação pessoal para gerir a tua saúde e bem-estar — começou com o
          módulo de Plano Alimentar, e vai crescer com mais módulos (treino,
          métricas, e outros) ao longo do tempo. Cada pessoa tem a sua própria
          conta e os seus próprios dados.
        </p>
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>O que mudou</div>
        {visible.map(c => (
          <div key={c.version} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Versão {c.version}</div>
            <div style={{ fontSize: 12.5, color: "#6b7268" }}>{c.notes}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
