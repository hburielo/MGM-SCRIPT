# MGM-SCRIPT

# MGM Script

Script de automação para creditar saldo e adicionar comentários administrativos em usuários indicadores no painel `admin.parafuzo.com`, a partir de uma planilha CSV.

## Como funciona

O script lê um arquivo `usuarios.csv` e, para cada usuário:

1. Acessa a página do usuário no painel admin
2. Adiciona R$ 40,00 ao saldo atual
3. Adiciona uma nota administrativa com o comentário sugerido

Os resultados são salvos em `sucesso.json` e os erros em `erros.json`.

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- Acesso ao painel `admin.parafuzo.com`

## Instalação

```bash
npm install
npx playwright install chromium
```

## Uso

### 1. Login (apenas na primeira vez)

```bash
node index.js login
```

Abre o browser para você fazer login manualmente. Feche o browser quando terminar — a sessão é salva em `./session/` e reutilizada nas próximas execuções.

### 2. Preparar o CSV

Crie um arquivo `usuarios.csv` na raiz do projeto com as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| `user_indicador` | URL do usuário no painel admin (ex: `https://admin.parafuzo.com/users/abc123`) |
| `jobs_realizados` | Número de jobs realizados |
| `admin_note_sugerido` | Texto do comentário a ser adicionado |

Exemplo:

```csv
user_indicador,jobs_realizados,admin_note_sugerido
https://admin.parafuzo.com/users/abc123,5,MGM - 5 indicações realizadas
https://admin.parafuzo.com/users/def456,3,MGM - 3 indicações realizadas
```

### 3. Executar

```bash
node index.js run
```

### 4. Inspecionar um usuário (opcional)

Para abrir um usuário específico e inspecionar a interface:

```bash
node index.js inspect <url_do_usuario>
```

## Estrutura do projeto

```
mgm-script/
├── index.js          # Script principal
├── usuarios.csv      # CSV com os usuários (você cria)
├── sucesso.json      # Resultado dos usuários processados com sucesso
├── erros.json        # Usuários que falharam durante o processamento
├── session/          # Sessão do browser (criada após o login)
└── package.json
```

## Configuração

As principais configurações ficam no topo de `index.js`:

| Variável | Valor padrão | Descrição |
|----------|-------------|-----------|
| `CREDIT_AMOUNT` | `40.00` | Valor em reais adicionado ao saldo |
| `DELAY_BETWEEN_USERS_MS` | `2000` | Pausa entre cada usuário (ms) |
