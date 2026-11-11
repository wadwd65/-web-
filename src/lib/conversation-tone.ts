/** A social turn has no task payload. Mixed greetings + business stay on the tool path. */
export function isConversationalTurn(text:string):boolean{
 const clean=text.trim().replace(/[\s，,。.!！?？~～、：:]/gu,'');
 if(!clean||clean.length>80)return false;
 return /^(?:(?:你好呀?|您好|嗨|哈[喽啰罗]|hello|hi|hey|ciallo|早上好|早安|中午好|下午好|晚上好|晚安|在吗|在不在|谢谢你?|多谢|谢啦|好的|好哒|收到|明白了|ok|嗯嗯|拜拜|再见|初程|小初))+$/iu.test(clean)
  ||/^(?:你是谁|你叫什么|怎么称呼你|你能(?:做什么|帮我(?:做)?什么)|你有什么功能|这里能做什么|我(?:第一次用|不知道怎么(?:说|开始)|不太会用|不知道从哪(?:说|开始))|(?:能不能|可以|我想|我们)?(?:正常|随便|先)?(?:聊聊|聊天|打个招呼)|(?:我)?不想(?:填表|按项回答)|你的回答(?:好|太|有点)?死板(?:了)?)$/u.test(clean);
}
