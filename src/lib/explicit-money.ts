/** Read an explicit yuan amount, never a range, estimate or colloquial omission. */
const digits:Record<string,number>={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
const units:Record<string,number>={十:10,百:100,千:1000};
function section(text:string):number|null{
 if(!text)return null;
 let total=0,pending:number|null=null,last=10000,zero=false,tailZero=false;
 for(const character of text){
  if(character in digits){
   const digit=digits[character];
   if(digit===0){if(pending!==null||zero)return null;zero=true;continue;}
   if(pending!==null)return null;
   pending=digit;tailZero=zero;zero=false;
  }else{
   const unit=units[character];if(!unit||unit>=last||zero)return null;
   if(pending===null&&!(unit===10&&total===0))return null;
   total+=(pending??1)*unit;pending=null;last=unit;tailZero=false;
  }
 }
 if(zero)return null;
 // 八千五 / 一百二 omit a place value and are ambiguous; 八千零五 is explicit.
 if(pending!==null){if(last>10&&last!==10000&&!tailZero)return null;total+=pending;}
 return total;
}
function chineseInteger(text:string):number|null{
 const parts=text.split('万');if(parts.length>2)return null;
 if(parts.length===1)return text==='零'?0:section(text);
 const upper=section(parts[0]);if(upper===null||upper===0)return null;
 if(!parts[1])return upper*10000;
 const lower=section(parts[1]);if(lower===null)return null;
 if(!parts[1].startsWith('零')&&lower<1000)return null;
 return upper*10000+lower;
}
export function explicitMoney(body:string):number|null{
 const text=body.replace(/^(?:[:：=\s¥￥]|是|为|应是|应为|更正为|改为|扣了|扣除|扣的|扣|金额|本次|共|合计)*/u,'');
 // Reject the entire amount phrase before considering its first number.
 if(/到|至|[~～—–-]|起|以上|以下|超过|不超过|至少|最多|约|左右|上下|差不多|[<>≤≥±]/u.test(text))return null;
 const arabic=text.match(/^((?:\d+(?:\.\d{1,6})?|\.\d{1,6}))([kK千万]?)(?:(?:元|块)(?![\d.零一二两三四五六七八九十百千万])|(?=[\s（(]|$))/u);
 if(arabic){
  const [whole,fraction='']=arabic[1].split('.'),scale=arabic[2]?({k:1000,K:1000,千:1000,万:10000}[arabic[2]]??1):1;
  const denominator=10n**BigInt(fraction.length),cents=BigInt((whole||'0')+fraction)*BigInt(scale)*100n;
  if(cents%denominator!==0n)return null;
  const integerCents=cents/denominator;
  return integerCents<=100_000_000_000n?Number(integerCents)/100:null;
 }
 const chinese=text.match(/^([零一二两三四五六七八九十百千万]+)(?:点([零一二三四五六七八九]{1,2}))?(?:(?:元|块)(?![\d.零一二两三四五六七八九十百千万])|(?=[\s（(]|$))/u);
 if(!chinese)return null;
 const integer=chineseInteger(chinese[1]);if(integer===null)return null;
 const fraction=chinese[2]?[...chinese[2]].map(c=>digits[c]).join('').padEnd(2,'0'):'0';
 return (integer*100+Number(fraction))/100;
}
