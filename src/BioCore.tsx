/** Original, lightweight vector artwork. A visual identity element, not a processing indicator. */
export default function BioCore() {
  return <div className="bio-core" aria-hidden="true">
    <div className="core-topline"><span>RHINE LAB / FIRST STEP</span><span className="core-id">01 · 03</span></div>
    <svg viewBox="0 0 520 380" fill="none">
      <defs>
        <linearGradient id="core-glass" x1="180" y1="70" x2="340" y2="290" gradientUnits="userSpaceOnUse"><stop stopColor="#d0f7ed" stopOpacity=".13" /><stop offset=".43" stopColor="#62a995" stopOpacity=".025" /><stop offset="1" stopColor="#baf8b8" stopOpacity=".12" /></linearGradient>
        <linearGradient id="core-metal" x1="170" y1="0" x2="345" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#253f3b" /><stop offset=".35" stopColor="#99b5a9" /><stop offset=".48" stopColor="#d6e5da" /><stop offset=".55" stopColor="#729489" /><stop offset="1" stopColor="#263f39" /></linearGradient>
        <linearGradient id="core-leaf" x1="220" y1="100" x2="290" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="#d9f7a0" /><stop offset=".5" stopColor="#83d5ab" /><stop offset="1" stopColor="#3d9b87" /></linearGradient>
        <linearGradient id="core-shine" x1="190" y1="80" x2="300" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="white" stopOpacity=".35" /><stop offset=".5" stopColor="white" stopOpacity="0" /></linearGradient>
        <radialGradient id="core-light"><stop stopColor="#a1e2aa" stopOpacity=".22" /><stop offset="1" stopColor="#7acb9e" stopOpacity="0" /></radialGradient>
        <filter id="core-bloom"><feGaussianBlur stdDeviation="3" /></filter>
        <pattern id="core-matrix" width="23" height="23" patternUnits="userSpaceOnUse"><path d="M23 0H0V23" stroke="#a5d8c2" strokeOpacity=".075" strokeWidth=".5" /></pattern>
      </defs>
      <rect width="520" height="380" fill="url(#core-matrix)" />
      <ellipse cx="263" cy="198" rx="193" ry="171" fill="url(#core-light)" />
      <g stroke="#8daf9b" strokeWidth=".7" opacity=".42"><path d="M262 14V41M262 326V353M77 191H111M410 191H443" /><circle cx="262" cy="191" r="150" /><circle cx="262" cy="191" r="128" strokeDasharray="2 7" /><ellipse cx="262" cy="191" rx="177" ry="44" transform="rotate(-24 262 191)" /></g>
      <g className="core-orbit" stroke="#b9e4b2" strokeWidth="2"><path d="M157 83a150 150 0 0 1 49-31M391 269a150 150 0 0 1-35 37M120 239a150 150 0 0 1-8-49" /></g>
      <g stroke="#a7d3b7" strokeOpacity=".5" strokeWidth=".8"><path d="M70 110H126L180 143M336 112H404L436 80M333 263H381L418 294H463M123 296H164L194 265" /><circle cx="70" cy="110" r="3" fill="#addb9c" /><circle cx="436" cy="80" r="3" fill="#addb9c" /><circle cx="463" cy="294" r="3" fill="#addb9c" /></g>
      <g className="core-assembly">
        <path d="M191 65H326L340 79V284L326 298H191L177 284V79L191 65Z" fill="url(#core-glass)" stroke="#b5e0ca" strokeOpacity=".45" />
        <path d="M191 77H316L326 87V276L316 286H191V77Z" stroke="#9dcdb8" strokeOpacity=".2" />
        <path d="M189 79H213L187 283V81Z" fill="url(#core-shine)" /><path d="M323 92V260" stroke="#e1f7e8" strokeOpacity=".45" />
        <path d="M191 57H325L334 65V78H182V65L191 57Z" fill="url(#core-metal)" stroke="#a9c9b6" strokeOpacity=".5" />
        <path d="M182 285H334V300L324 310H192L182 300V285Z" fill="url(#core-metal)" stroke="#a9c9b6" strokeOpacity=".5" />
        <path d="M202 64H314M201 302H314" stroke="#d4edcf" strokeOpacity=".5" /><path d="M207 73H309M207 290H309" stroke="#102f27" strokeWidth="3" />
        <g fill="#1c3930" stroke="#99b9a6" strokeWidth=".7"><circle cx="191" cy="68" r="2.8" /><circle cx="325" cy="68" r="2.8" /><circle cx="191" cy="296" r="2.8" /><circle cx="325" cy="296" r="2.8" /></g>
        <g className="life-ribbon">
          <path d="M257 268C213 230 301 211 261 168C231 136 242 121 260 101M257 268C302 230 214 211 254 168C284 136 273 121 255 101" stroke="url(#core-leaf)" strokeWidth="3" />
          {Array.from({ length: 17 }, (_, i) => { const y = 111 + i * 9; const spread = Math.sin((i / 16) * Math.PI * 3.3) * 22; return <path key={i} d={`M${257 - spread} ${y}L${257 + spread} ${y + 4}`} stroke="#aee6b4" strokeOpacity={.24 + Math.abs(spread) / 80} strokeWidth=".8" />; })}
          <path d="M257 170C228 165 224 146 228 127C251 128 268 146 257 170Z" fill="url(#core-leaf)" fillOpacity=".3" stroke="#b6edb7" strokeOpacity=".7" /><path d="M258 208C285 203 293 184 289 168C269 171 251 185 258 208Z" fill="url(#core-leaf)" fillOpacity=".25" stroke="#b6edb7" strokeOpacity=".7" />
          <circle cx="259" cy="179" r="48" fill="#a3e7b1" opacity=".09" filter="url(#core-bloom)" />
        </g>
        <path d="M185 104H193M185 120H190M185 136H193M185 152H190M185 168H193M185 184H190M185 200H193M185 216H190M185 232H193M185 248H190M185 264H193" stroke="#b1d5ba" strokeOpacity=".6" />
      </g>
      <g fill="#afc8bc" fontFamily="Consolas,monospace" fontSize="8" letterSpacing="1"><text x="29" y="95">CLEAR.</text><text x="421" y="66">CONNECT.</text><text x="418" y="315">MOVE ON.</text><text x="236" y="342" fill="#cce4c5">F / 01</text></g>
      <g stroke="#b3d5c2" strokeOpacity=".35"><path d="M24 27V17H38M482 17H496V27M24 352V362H38M482 362H496V352" /></g>
    </svg>
    <div className="core-bottomline"><span className="core-signal"><i /><i /><i /><i /><i /></span><span>让每一步，清楚而有据。</span><span className="core-marker">+</span></div>
  </div>;
}
