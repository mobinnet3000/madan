import{c as x,j as t,ac as m}from"./index-CD_hrIbR.js";/**
 * @license lucide-react v0.445.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=x("ChevronLeft",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-react v0.445.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=x("ChevronRight",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);function u({currentPage:e,totalPages:a,onPageChange:o,disabled:r=!1}){if(a<=1)return null;const n=[],l=5;let i=Math.max(1,e-Math.floor(l/2)),h=Math.min(a,i+l-1);h-i+1<l&&(i=Math.max(1,h-l+1)),i>1&&(n.push(1),i>2&&n.push("dots"));for(let s=i;s<=h;s++)n.push(s);return h<a&&(h<a-1&&n.push("dots"),n.push(a)),t.jsxs("nav",{className:"flex items-center justify-center gap-1.5","aria-label":"صفحه‌بندی",children:[t.jsx("button",{onClick:()=>o(e-1),disabled:e===1||r,className:"btn-ghost h-9 w-9 !px-0 rounded-xl","aria-label":"صفحه قبلی",children:t.jsx(f,{className:"h-4 w-4"})}),n.map((s,d)=>s==="dots"?t.jsx("span",{className:"flex h-9 w-9 items-center justify-center text-xs text-ink-400 dark:text-slate-500",children:"..."},`dots-${d}`):t.jsx("button",{onClick:()=>o(s),disabled:r,className:m("h-9 min-w-[36px] rounded-xl px-2 text-sm font-medium transition",s===e?"bg-brand-500 text-white shadow-sm hover:bg-brand-600":"text-ink-600 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800"),children:s},s)),t.jsx("button",{onClick:()=>o(e+1),disabled:e===a||r,className:"btn-ghost h-9 w-9 !px-0 rounded-xl","aria-label":"صفحه بعدی",children:t.jsx(c,{className:"h-4 w-4"})})]})}export{f as C,u as P,c as a};
