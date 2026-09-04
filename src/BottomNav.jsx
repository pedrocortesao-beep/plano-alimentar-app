import { Utensils, TrendingUp, Dumbbell } from "lucide-react";
import { styles } from "./styles";

// Cada módulo diz a que separador principal leva, quais os ecrãs desse
// módulo (para saber quando o ícone fica "ativo"), e o ícone/rótulo. Só
// aparece na barra se o módulo estiver ativo nos "Módulos" da pessoa.
const MODULE_NAV = {
  plano_alimentar: { tab: "hoje", relatedTabs: ["hoje", "gerir"], label: "Alimentar", Icon: Utensils },
  metricas: { tab: "metricas", relatedTabs: ["metricas"], label: "Métricas", Icon: TrendingUp },
  plano_treino: { tab: "treino", relatedTabs: ["treino"], label: "Treino", Icon: Dumbbell },
};

export default function BottomNav({ modules, currentTab, onNavigate }) {
  const items = (modules || []).map(key => MODULE_NAV[key]).filter(Boolean);
  if (items.length < 2) return null; // com um módulo só, não vale a pena ocupar espaço

  return (
    <nav style={styles.bottomNav}>
      {items.map(item => (
        <button key={item.tab}
          style={{ ...styles.bottomNavBtn, ...(item.relatedTabs.includes(currentTab) ? styles.bottomNavBtnActive : {}) }}
          onClick={() => onNavigate(item.tab)}>
          <item.Icon size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
