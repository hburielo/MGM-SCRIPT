const { chromium } = require('playwright');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, 'usuarios.csv');
const SESSION_DIR = path.join(__dirname, 'session');
const CREDIT_AMOUNT = '40.00';
const DELAY_BETWEEN_USERS_MS = 2000; // pausa entre cada usuário para não sobrecarregar

// ─── SELETORES ────────────────────────────────────────────────────────────────
const SELECTORS = {
  // Modal de saldo
  editBalanceButton: 'a.simple-ajax-modal[href$="/balance"]',
  balanceInput: 'input[name="user[balance]"]',

  // Modal de comentário
  newNoteButton: 'a.simple-ajax-modal[href$="/admin_notes/new"]',
  noteTextarea: 'textarea[name="admin_note[note]"]',

  // Botão de salvar (usado nos dois modais)
  confirmButton: 'input[type="submit"][name="commit"]',
};
// ─────────────────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function login() {
  console.log('🔐 Modo login — faça login na sua conta de trabalho e feche o browser quando terminar.');
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  await page.goto('https://admin.parafuzo.com');
  console.log('✅ Browser aberto. Faça login e feche a janela quando terminar.');
  // Aguarda o browser ser fechado manualmente
  await browser.waitForEvent('close').catch(() => {});
  console.log('✅ Sessão salva em ./session');
}

async function inspectUser(userUrl) {
  console.log(`🔍 Modo inspeção — abrindo: ${userUrl}`);
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  await page.goto(userUrl);
  console.log('Página aberta. Use o DevTools para identificar os seletores e atualizar SELECTORS em index.js.');
  console.log('Feche o browser quando terminar.');
  await browser.waitForEvent('close').catch(() => {});
}

async function processUser(page, user) {
  console.log(`\n👤 Processando: ${user.user_indicador}`);

  await page.goto(user.user_indicador, { waitUntil: 'networkidle' });

  // ── 1. Editar saldo ──────────────────────────────────────────────────────
  await page.click(SELECTORS.editBalanceButton);
  await page.waitForSelector(SELECTORS.balanceInput, { state: 'visible' });

  const currentValue = await page.inputValue(SELECTORS.balanceInput);
  const currentBalance = parseFloat(currentValue) || 0;
  const newBalance = (currentBalance + 40).toFixed(2);
  await page.fill(SELECTORS.balanceInput, newBalance);
  await page.click(SELECTORS.confirmButton);
  await page.waitForTimeout(1000);

  console.log(`  💰 Saldo: ${currentBalance} → ${newBalance}`);

  // ── 2. Adicionar comentário ───────────────────────────────────────────────
  await page.click(SELECTORS.newNoteButton);
  await page.waitForSelector(SELECTORS.noteTextarea, { state: 'visible' });

  await page.fill(SELECTORS.noteTextarea, user.admin_note_sugerido);
  await page.click(SELECTORS.confirmButton);
  await page.waitForTimeout(1000);

  console.log(`  📝 Note adicionado: ${user.admin_note_sugerido}`);
}

async function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${CSV_PATH}`);
    console.error('   Copie o CSV exportado da planilha para ./usuarios.csv');
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf-8').replace(/^﻿/, '');
  const users = parse(content, { columns: true, skip_empty_lines: true });

  const REQUIRED_COLUMNS = ['user_indicador', 'jobs_realizados', 'admin_note_sugerido'];
  if (users.length > 0) {
    const actualColumns = Object.keys(users[0]);
    const missing = REQUIRED_COLUMNS.filter(col => !actualColumns.includes(col));
    if (missing.length > 0) {
      console.error(`❌ O CSV está com colunas erradas. Faltando: ${missing.join(', ')}`);
      console.error(`   Colunas encontradas: ${actualColumns.join(', ')}`);
      console.error(`   Colunas esperadas:   ${REQUIRED_COLUMNS.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`📋 ${users.length} usuários encontrados no CSV.`);

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();
  const errors = [];
  const successes = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\n[${i + 1}/${users.length}]`);
    try {
      await processUser(page, user);
      successes.push({ id: user.user_indicador, comentario: user.admin_note_sugerido });
      await sleep(DELAY_BETWEEN_USERS_MS);
    } catch (err) {
      console.error(`  ❌ Erro: ${err.message}`);
      errors.push({ user: user.user_indicador, error: err.message });
    }
  }

  await browser.close();

  if (successes.length > 0) {
    fs.writeFileSync(
      path.join(__dirname, 'sucesso.json'),
      JSON.stringify(successes, null, 2)
    );
    console.log(`\n✅ ${successes.length} usuário(s) processado(s) com sucesso. Detalhes salvos em sucesso.json`);
  }

  if (errors.length > 0) {
    console.log('\n⚠️  Usuários com erro:');
    errors.forEach(e => console.log(`  - ${e.user}: ${e.error}`));
    fs.writeFileSync(
      path.join(__dirname, 'erros.json'),
      JSON.stringify(errors, null, 2)
    );
    console.log('  Detalhes salvos em erros.json');
  } else {
    console.log('\n🎉 Todos os usuários processados com sucesso!');
  }
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
const mode = process.argv[2];

if (mode === 'login') {
  login().catch(console.error);
} else if (mode === 'inspect') {
  const url = process.argv[3];
  if (!url) {
    console.error('Usage: node index.js inspect <url_do_usuario>');
    process.exit(1);
  }
  inspectUser(url).catch(console.error);
} else if (mode === 'run') {
  run().catch(console.error);
} else {
  console.log(`
📖 Uso:
  node index.js login            → abre o browser para fazer login (rode apenas uma vez)
  node index.js inspect <url>    → abre um usuário específico para inspecionar a UI
  node index.js run              → processa todos os usuários do CSV

📁 Estrutura esperada:
  mgm-script/
  ├── index.js
  ├── usuarios.csv   ← copie o CSV exportado da planilha aqui
  └── session/       ← criado automaticamente após o login
  `);
}
