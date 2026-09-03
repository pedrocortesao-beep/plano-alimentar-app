import { styles } from "./styles";

export const APP_VERSION = "1.8.4";

export const CHANGELOG = [
  { version: "1.8.4", notes: "Preencher valores nutricionais à mão propaga automaticamente para ingredientes com o mesmo nome no resto do plano." },
  { version: "1.8.3", notes: "Sugestões nutricionais aplicam-se automaticamente a todos os ingredientes já existentes, sem precisar de abrir cada opção." },
  { version: "1.8.2", notes: "Total do dia soma sempre a 1ª opção de cada refeição, e os avisos dizem agora quais ingredientes faltam." },
  { version: "1.8.1", notes: "Total estimado de calorias e macros do dia, logo no topo do ecrã \"Hoje\"." },
  { version: "1.8.0", notes: "Base de alimentos passou para a base de dados — o admin pode adicionar/editar alimentos, atualizado para todos sem nova versão." },
  { version: "1.7.2", notes: "Sugestões nutricionais aplicadas automaticamente, e correção do desalinhamento no ecrã de macros." },
  { version: "1.7.1", notes: "Sugestões automáticas de valores nutricionais para ingredientes comuns (aveia, banana, frango, ...)." },
  { version: "1.7.0", notes: "Valores nutricionais por ingrediente e soma automática de calorias/macros por opção." },
  { version: "1.6.3", notes: "Correção no ecrã Hoje: sem quantidade, a unidade não aparece; unidades \"unidade\" mostram \"Un\"." },
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
