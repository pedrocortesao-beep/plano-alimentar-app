// Itens do menu ⋮ que o administrador pode reordenar, agrupar em submenus, e
// mostrar/esconder por grupo. "Sobre a app" fica sempre por último e
// "Administração" é sempre exclusivo de administradores — nenhum dos dois
// está nesta lista nem na estrutura editável.
export const MENU_ITEMS = [
  { key: "gerir", label: "Gerir plano" },
  { key: "partilhar", label: "Partilhar" },
  { key: "agua", label: "Lembrete de água" },
  { key: "sugestoes", label: "Sugerir melhorias" },
  { key: "dados", label: "Dados pessoais" },
  { key: "modulos", label: "Módulos" },
  { key: "tutores", label: "Tutores" },
];

export const DEFAULT_MENU_ORDER = MENU_ITEMS.map(i => i.key);

export const DEFAULT_MENU_STRUCTURE = MENU_ITEMS.map(i => ({ type: "item", key: i.key }));

export const GROUPS = [
  { key: "user", label: "Utilizadores" },
  { key: "tutor", label: "Tutores" },
];

// Todas as chaves de item já colocadas algures na estrutura (topo ou dentro
// de submenus) — para saber quais ainda estão por atribuir.
export function usedKeys(structure) {
  const used = new Set();
  (structure || []).forEach(node => {
    if (node.type === "item") used.add(node.key);
    if (node.type === "submenu") (node.items || []).forEach(k => used.add(k));
  });
  return used;
}

export function unplacedItems(structure) {
  const used = usedKeys(structure);
  return MENU_ITEMS.filter(i => !used.has(i.key));
}
