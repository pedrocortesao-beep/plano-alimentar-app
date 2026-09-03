const PHRASES = [
  "Comer bem não é perfeição — é constância.",
  "Cada refeição é uma oportunidade nova, não um teste.",
  "O corpo agradece hoje as escolhas de hoje.",
  "Não precisas de um dia perfeito, só de uma próxima refeição melhor.",
  "Pequenos hábitos, repetidos, valem mais do que grandes esforços pontuais.",
  "Comer com atenção é uma forma de te cuidares.",
  "O progresso não se vê num prato — vê-se num mês de pratos.",
  "Beber água, comer com calma: o básico bem feito já é muito.",
  "Não estás a começar do zero, estás a continuar.",
  "A disciplina de hoje é o à-vontade de amanhã.",
  "Um dia menos bom não apaga todos os outros bons.",
  "Cuidar do corpo é uma forma de respeito próprio.",
  "Comer variado é dar ao corpo o que ele precisa, não o que falta.",
  "A consistência vence a intensidade quase sempre.",
  "Cada escolha saudável é um voto na pessoa que queres ser.",
  "Não é sobre restringir — é sobre nutrir.",
  "O teu plano existe para te ajudar, não para te pressionar.",
  "Hidratar é tão importante como alimentar.",
  "Comer devagar é já meio caminho andado para comer melhor.",
  "A energia de hoje começou no prato de hoje.",
  "Não compares o teu dia 1 com o dia 100 de outra pessoa.",
  "Descansar bem também é cuidar da alimentação — o corpo recupera a dormir.",
  "Um copo de água antes da refeição já é um cuidado a mais.",
  "O objetivo é sentires-te bem, não seres perfeito.",
  "Cada opção no teu plano é uma escolha feita com cuidado — confia nela.",
  "A regularidade das refeições ajuda tanto quanto o que está no prato.",
  "Hoje é só mais um dia de construir o hábito — sem drama, sem pressa.",
  "Come com prazer. A comida também é para isso.",
  "O melhor plano é o que consegues seguir, não o mais rígido.",
  "Um passo de cada vez, uma refeição de cada vez.",
  "Estás a investir em ti — e isso nota-se com o tempo, não de um dia para o outro.",
  "A força de vontade cansa-se; os hábitos não.",
  "Comer bem é um ato de carinho por quem és daqui a dez anos.",
  "Não precisas de motivação todos os dias — precisas de rotina.",
  "O corpo não pede perfeição, pede cuidado contínuo.",
  "Cada refeição equilibrada soma, mesmo que não pareça.",
  "A tua energia de amanhã agradece as escolhas de hoje.",
  "Não é sobre nunca falhar — é sobre voltar sempre.",
  "Simplificar as refeições também é uma forma de te facilitar a vida.",
  "Cuidar da alimentação é cuidar de quase tudo o resto também.",
];

// Escolhe determinística e consistentemente uma frase por dia (mesma frase
// o dia todo, muda à meia-noite), sem precisar de nenhum servidor.
export function getTodayPhrase() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return PHRASES[dayOfYear % PHRASES.length];
}
