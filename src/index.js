const TelegramBot = require('node-telegram-bot-api');
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');
require('dotenv').config();

const TOKEN= process.env.TOKEN;
const KEY = process.env.KEY;
const bot = new TelegramBot(TOKEN, {polling: true});
const languageMap = new Map();
let languageCode=process.env.DEFULT_LANG;
let jokesArr=[];

// Function that gets all supported languages by Azure translator
async function getSupportedLanguages(){
    const endpoint = 'https://api.cognitive.microsofttranslator.com/languages';

    try {
        const response = await axios({
            method: 'get',
            url: `${endpoint}?api-version=3.0`,
            headers: {
                'Ocp-Apim-Subscription-Key': KEY,
            },
        });

        const languages = response.data.translation;
        Object.keys(languages).forEach((languageCode) => {
            const languageName = languages[languageCode].name.toLowerCase();
            languageMap.set(languageName, languageCode);
        });

    } catch (err) {
        console.error('Error in getSupportedLanguages function', err.message);
    }
}

// Function that translates text using Azure translator
async function translateText(message,languageCode) {
    const endpoint = "https://api.cognitive.microsofttranslator.com";
    const location = "eastus2";

    try {
        const response = await axios({
            baseURL: endpoint,
            url: '/translate',
            method: 'post',
            headers: {
                'Ocp-Apim-Subscription-Key': KEY,
                'Ocp-Apim-Subscription-Region': location,
                'Content-type': 'application/json',
                'X-ClientTraceId': uuidv4().toString()
            },
            params: {
                'api-version': '3.0',
                'from': process.env.DEFULT_LANG,
                'to': languageCode,
            },
            data: [{
                'text': message,
            }],
            responseType: 'json'
        });
        const jsonString = JSON.parse(JSON.stringify(response.data, null, 4));

        return jsonString[0].translations[0].text;

    } catch (err) {
        console.error('Error in translateText function ', err.message);
    }
}

// Function that retrieves Chuck Norris jokes from a given URL
async function getChuckNorrisJokes(){
    const url="https://parade.com/968666/parade/chuck-norris-jokes/";
    const jokes=[];
    const headers = {
        Accept: "text/html",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.5",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0",
    };

    try{
        const response = await axios.get(url,{headers});
        const html = response.data;
        const $ = cheerio.load(html);
        $(".m-detail--body ol li").each((index,elem)=>{
            const joke=$(elem);
            jokes.push(joke.text());
        })

        return jokes;
    } catch(err){
        console.error("Error in getChuckNorrisJokes function", err.message);
        return [];
    }
}

// Function that fetches a joke by index and translates the joke to the target language
async function fetchJokeByIndex(jokeIndex,msg){
    try{

        if(jokesArr.length===0){
            jokesArr= await getChuckNorrisJokes();
        }


        if(jokeIndex>=1 && jokeIndex<=101){
            const joke=jokesArr[jokeIndex-1];
            const translatedJoke = await translateText(joke,languageCode);
            bot.sendMessage(msg.chat.id, `${jokeIndex}. ${translatedJoke}`);
        }
        else{
            bot.sendMessage(msg.chat.id, "Please enter valid number (between 1 to 101)");
        }

    } catch(err){
        console.error('Error in fetchJokeByIndex function', err.message);
    }
}

// TelegramBot function that handle the /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const startMsg=
    `Welcome to ChuckBot.\nThe default language is English.\n\nTo set your language, use the command:\nset language <Your language>\n
To get a joke, please select a number between 1 and 101 by using the command:\n<Joke number>`;
    languageCode=process.env.DEFULT_LANG;

    bot.sendMessage(chatId, startMsg);
});

// TelegramBot function that get the user's selected language
bot.onText(/set language (\w+)/i, async(msg,match)=>{
    const chatId = msg.chat.id;
    const language = match[1].toLowerCase(); 
    languageCode = languageMap.get(language);

    try{
        if(languageCode){
            const translatedMsg = await translateText("No problem",languageCode);
            bot.sendMessage(chatId, translatedMsg);
        } else{
            bot.sendMessage(chatId, "This language unsupported.Please try again.");
        }
    } catch(err){
        console.error('Error in setLanguage bot function', err.message)
    }
    
});

/* TelegramBot function that get a joke index from the user
   Returns the joke at the selected index in the chosen language */
bot.onText(/\d+/g,async(msg)=>{
    const jokeNum = parseInt(msg.text);
    try{
        await fetchJokeByIndex(jokeNum,msg);
    } catch(err){
        console.error('Error in fetching joke by number', err.message)
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMsg="Here are the valid commands:\n1. /start - Initiate the chat\n2. /help - See the list of available commands\n3. set language <Your Language> - Set your preferred language\n4. <Joke number> - Get a Chuck Norris joke by number between 1 and 101"
    bot.sendMessage(chatId,helpMsg );
});

/* TelegramBot function that handles incoming messages and responds
   if the message does not match predefined commands */
bot.on('message', async(msg)=>{
    const chatId = msg.chat.id;

    if (!msg.text.match(/set language (\w+)/i) && !msg.text.match(/\d+/g)
         && !msg.text.match(/\/start/) && !msg.text.match(/\/help/) ) {
        bot.sendMessage(chatId, `I didn't understand that. Please use the commands mentioned at the beginning of the chat. Click /help to see the valid commands`);
    }
})

getSupportedLanguages();

