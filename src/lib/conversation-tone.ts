/** A social turn has no task payload. Mixed greetings + business stay on the tool path. */
export function isConversationalTurn(text:string):boolean{
 const clean=text.trim().replace(/[\s，,。.!！?？~～、：:]/gu,'');
 if(!clean||clean.length>140)return false;
 const standalone=/^(?:(?:你好呀?|您好|嗨|哈[喽啰罗]|hello|hi|hey|ciallo|早上好|早安|中午好|下午好|晚上好|晚安|在吗|在不在|谢谢你?|多谢|谢啦|好的|好哒|收到|明白了|ok|嗯嗯|拜拜|再见|初程|小初))+$/iu.test(clean)
  ||/^(?:你是谁|你叫什么|怎么称呼你|你能(?:做什么|帮我(?:做)?什么)|你有什么功能|这里能做什么|我(?:第一次用|不知道怎么(?:说|开始)|不太会用|不知道从哪(?:说|开始))|(?:能不能|可以|我想|我们)?(?:正常|随便|先)?(?:聊聊|聊天|打个招呼)|(?:我)?不想(?:填表|按项回答)|你的回答(?:好|太|有点)?死板(?:了)?)$/u.test(clean);
 if(standalone)return true;
 // Consume whole onboarding phrases, rather than treating every greeting prefix
 // as small talk. Any remaining business payload must keep the grounded tool path.
 if(!/第一次|不太会用|不知道怎么|不知道从哪|不想填表|不想按项回答|能做什么|能帮我(?:做)?什么|有什么功能|怎么开始|直接说/u.test(clean))return false;
 let rest=clean;
 const phrase=/^(?:你好呀?|您好|嗨|哈[喽啰罗]|hello|hi|hey|ciallo|初程|小初|我刚毕业|我是新手|我第一次(?:使用|用)(?:这个网站|这里)?|(?:我)?不太会用(?:这个网站|这里)?|我不知道怎么(?:说|开始)|我不知道从哪(?:说|开始)|我不想(?:填表|按项回答)|我(?:就)?想直接说|我想知道|想知道|你能帮我做什么|你能做什么|你有什么功能|这里能做什么|你能帮我吗|可以先告诉我怎么开始吗|怎么开始|能不能|可以|请|先|谢谢|呀|啊|呢|吗)/iu;
 while(rest){const match=rest.match(phrase);if(!match)return false;rest=rest.slice(match[0].length);}
 return true;
}
