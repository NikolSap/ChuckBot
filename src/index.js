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
        if (!languageCode) {
            throw new Error(`Language not found in map for language: ${language}`);
        }

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
                'from': 'en',
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
        throw err; 
    }
}


// Function that retrieves Chuck Norris jokes from a given URL
async function getChuckNorrisJokes(){
    const url="https://parade.com/968666/parade/chuck-norris-jokes/";
    const headers = {
        Accept: "text/html",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.5",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0",
    };

    try{
        const jokes=[];
        const response = await axios.get(url,{headers});
        const html = response.data;
        const $ = cheerio.load(html);
        $(".m-detail--body ol li").each((index,elem)=>{
            const joke=$(elem);
            jokes.push(joke.text());
        })
        return jokes;
    }catch(err){
        console.log("Error in getChuckNorrisJokes function");
        return [];
    }
}

// Function that fetches a joke by index and translates the joke to the chosen language
async function fetchJokeByIndex(jokeIndex,msg){

    try{
        if(jokesArr.length===0){
            console.log("empty")
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
    languageCode=process.env.DEFULT_LANG;
    const startMsg=
    `Welcome to ChuckBot.
    The default language is English.

    To set your language, use the message:
    set language <Your language>

    To get a joke, please select a number between 1 to 101 by
    using the message:
    <Joke number>`;

    bot.sendMessage(chatId, startMsg);
});

// TelegramBot function that get the user's selected language
bot.onText(/set language (\w+)/i, async(msg,match)=>{
    const chatId = msg.chat.id;

    try{
        const language = match[1].toLowerCase(); 
        languageCode = languageMap.get(language);
        if(languageCode){
            const translatedMsg = await translateText("No problem",languageCode);
            bot.sendMessage(chatId, translatedMsg);
        }else{
            bot.sendMessage(chatId, "This language unsupported.Please try again.");
        }
    } catch(err){
        bot.sendMessage(chatId, err.message);
    }
});

// TelegramBot function that get a joke index from the user
// Returns the joke at the selected index in the chosen language
bot.onText(/\d+/g,async(msg)=>{
    const jokeNum = parseInt(msg.text);
    await fetchJokeByIndex(jokeNum,msg);
});

// TelegramBot function that handles incoming messages and responds
// if the message does not match predefined commands
bot.on('message', async(msg)=>{
    const chatId = msg.chat.id;

    if (!msg.text.match(/set language (\w+)/i) && !msg.text.match(/\d+/g) && !msg.text.match(/\/start/)) {
        bot.sendMessage(chatId, "I didn't understand that. Please use the commands mentioned at the beginning of the chat.");
    }
})

getSupportedLanguages();

