# Plano Alimentar — versão real (Supabase + Vercel)

App React ligada a uma base de dados Supabase, com login próprio por
utilizador (email + palavra-passe + recuperação), pronta a publicar
como PWA instalável.

## 1. Criar a base de dados

1. No teu projeto Supabase, vai a **SQL Editor**.
2. Abre o ficheiro `supabase/schema.sql` deste projeto, copia tudo e cola no editor.
3. Clica **Run**. Isto cria as tabelas (`profiles`, `plans`, `meals`, `options`,
   `ingredients`), ativa a segurança (cada utilizador só vê os seus próprios
   dados) e cria automaticamente um perfil sempre que alguém se regista.
4. Em **Authentication → Providers**, confirma que "Email" está ativo
   (vem ativo por omissão).
5. Em **Authentication → URL Configuration**, define o "Site URL" como o
   endereço onde a app vai ficar publicada (ex.: `https://plano-alimentar.vercel.app`).
   Isto é necessário para o link de recuperação de palavra-passe funcionar.

## 2. Configurar as variáveis de ambiente

1. Copia `.env.example` para um novo ficheiro chamado `.env`.
2. Em Supabase, vai a **Project Settings → API** e copia:
   - **Project URL** → cola em `VITE_SUPABASE_URL`
   - **anon public key** → cola em `VITE_SUPABASE_ANON_KEY`

## 3. Correr localmente (para testar antes de publicar)

```bash
npm install
npm run dev
```

Abre o endereço que aparecer no terminal (normalmente `http://localhost:5173`).
Cria uma conta com o teu email, confirma-a (chega um email do Supabase),
e faz o mesmo depois para a tua esposa, com o email dela.

## 4. Publicar (GitHub + Vercel)

1. Cria um repositório novo no GitHub e envia este projeto para lá:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão"
   git branch -M main
   git remote add origin https://github.com/O-TEU-UTILIZADOR/plano-alimentar.git
   git push -u origin main
   ```
2. Em vercel.com, clica **Add New → Project**, escolhe esse repositório.
3. Em **Environment Variables**, adiciona as mesmas duas variáveis do `.env`
   (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
4. Clica **Deploy**. Em cerca de um minuto tens um link público
   (ex.: `plano-alimentar.vercel.app`).
5. Volta ao Supabase (**Authentication → URL Configuration**) e confirma que
   o "Site URL" corresponde exatamente a esse link.

## 5. Instalar no telemóvel

Abre o link publicado no telemóvel (Android ou iPhone) e usa
"Adicionar ao ecrã principal" (Android/Chrome) ou "Partilhar → Adicionar
ao ecrã de início" (iPhone/Safari). Fica com ícone e abre em ecrã inteiro,
como uma app instalada.

> Nota: o `public/manifest.json` está sem ícones próprios (para simplificar
> esta primeira versão). Isto não impede o "Adicionar ao ecrã principal",
> mas para o Chrome mostrar o convite automático de instalação, adiciona
> mais tarde um ícone 192×192 e outro 512×512 em `public/` e referencia-os
> no `manifest.json`.

## O que já funciona

- Registo, login, logout e recuperação de palavra-passe (por email), cada
  pessoa com a sua própria conta e os seus próprios dados — o Supabase
  garante que ninguém vê os dados de outra conta.
- Gerir refeições (criar, editar nome/hora, reordenar, apagar).
- Cada refeição com várias opções, cada opção com vários ingredientes
  (nome, quantidade, unidade, observações).
- Ecrã "Hoje" com a refeição da hora atual sempre aberta automaticamente.
- Observações ao nível do plano, da refeição e da opção.

## Limitações conhecidas desta primeira versão

- As alterações são otimistas (aparecem no ecrã de imediato) mas não há
  reversão automática se a escrita na base de dados falhar — para 2
  utilizadores numa rede normal isto raramente é um problema, mas convém
  saber.
- Um plano por pessoa (sem versões/arquivo de planos antigos) — a base de
  dados já está preparada para evoluir isso mais tarde, sem migração
  destrutiva.
- Sem partilha/administração entre utilizadores (secção 9 do documento
  original) — cada pessoa gere só o seu próprio plano, por agora.
