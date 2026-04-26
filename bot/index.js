require('dotenv').config({ path: '../.env' });
const { Bot, InlineKeyboard } = require('grammy');

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const GAME_URL = process.env.GAME_URL || 'https://YOUR-SITE.netlify.app';

const bot = new Bot(TOKEN);

bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name || 'Гравець';
    const keyboard = new InlineKeyboard().webApp('🎮 Грати', GAME_URL);

    await ctx.reply(
        `Привіт, ${name}! 👋\nЗапускай гру про Пана Сергія! 🎮`,
        { reply_markup: keyboard }
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        '🎮 *Пан Сергій Tap*\n\n' +
        'Тапай на Пана Сергія щоб заробляти очки\\!\n' +
        'Купуй апгрейди та аксесуари\\.\n\n' +
        '/start — запустити гру',
        { parse_mode: 'MarkdownV2' }
    );
});

bot.start();
console.log('🤖 Бот запущено!');
