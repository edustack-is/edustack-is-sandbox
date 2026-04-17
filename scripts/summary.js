
const chalk = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

console.log(`
${chalk.bold(chalk.cyan('🚀 EduStack IS – Development environment summary'))}
${chalk.gray('───────────────────────────────────────────────────')}

  ${chalk.green('➜  Frontend App:')}   ${chalk.bold('http://localhost:5173')}
  ${chalk.blue('➜  Backend API:')}    ${chalk.bold('http://localhost:3000')}
  ${chalk.yellow('➜  MCP Server:')}     ${chalk.bold('http://localhost:3001')}
  ${chalk.magenta('➜  MailDev Web:')}    ${chalk.bold('http://localhost:1081')}
  
  ${chalk.cyan('➜  API Specs:')}      ${chalk.bold('http://localhost:3000/api/docs')}

${chalk.gray('───────────────────────────────────────────────────')}
`);
