const { Bot, InlineKeyboard } = require('grammy');

const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const GAME_URL = process.env.GAME_URL || 'https://YOUR-SITE.netlify.app';

if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не встановлено!');
    process.exit(1);
}

const bot = new Bot(TOKEN);

// Встановити Menu Button при старті
async function setupMenuButton() {
    try {
        await bot.api.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '🎮 Грати',
                web_app: { url: GAME_URL }
            }
        });
        console.log('✅ Menu Button встановлено:', GAME_URL);
    } catch(e) {
        console.error('❌ Помилка Menu Button:', e.message);
    }
}

bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name || 'Гравець';
    const keyboard = new InlineKeyboard().webApp('🎮 Грати зараз', GAME_URL);

    await ctx.reply(
        `Привіт, ${name}! 👋\n\n` +
        `🎮 Пан Сергій Tap — тапай, заробляй, змагайся!\n\n` +
        `Натисни кнопку нижче або кнопку Грати в меню чату 👇`,
        { reply_markup: keyboard }
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        '🎮 Пан Сергій Tap\n\n' +
        'Тапай на Пана Сергія щоб заробляти очки!\n' +
        'Купуй апгрейди та аксесуари.\n' +
        'Відкривай кейси та крафти теми!\n\n' +
        '/start — запустити гру'
    );
});

bot.start({
    onStart: () => {
        console.log('🤖 Бот запущено! URL гри:', GAME_URL);
        setupMenuButton();
    }
});
