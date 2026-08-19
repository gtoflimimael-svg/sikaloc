// Compiles the app's own globals.css (the single source of truth for Sikaloc's
// tokens and component classes) into a static stylesheet the design tool can
// ship. Beyond the classes src/ already uses, it safelists the full token
// vocabulary — the design agent writes its own layout glue, and a utility that
// was never compiled here renders unstyled in every design that uses it.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

const ROOT = resolve(import.meta.dirname, '..')
const GLOBALS = resolve(ROOT, 'src/app/globals.css')
const OVERLAY = resolve(ROOT, '.design-sync/theme-sikaloc.css')
const OUT = resolve(ROOT, '.design-sync/pkg/styles.css')

// ── token vocabulary, read from @theme so it can never drift from the source
const css = readFileSync(GLOBALS, 'utf8')
// La couche de thème (theme-sikaloc.css) redéfinit et complète les tokens ;
// ses noms doivent entrer dans la safelist au même titre que ceux de l'app,
// sinon les utilitaires des nouveaux tokens ne seraient jamais compilés.
const overlay = readFileSync(OVERLAY, 'utf8')
const theme = [
  /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '',
  /@theme\s*\{([\s\S]*?)\n\}/.exec(overlay)?.[1] ?? '',
  /:root\s*\{([\s\S]*?)\n\}/.exec(overlay)?.[1] ?? '',
].join('\n')
const namesFor = (prefix) => [
  ...new Set(
    [...theme.matchAll(new RegExp(`^\\s*--${prefix}-([a-z0-9-]+):`, 'gm'))]
      .map((m) => m[1])
      // `--text-body-md--line-height` etc. are modifiers on a scale entry, not entries.
      .filter((n) => !n.includes('--')),
  ),
]
const colors = namesFor('color')
const spacing = namesFor('spacing')
const radius = namesFor('radius')
const text = namesFor('text')
const shadow = namesFor('shadow')

const list = (v) => `{${v.join(',')}}`
const lines = []
const push = (s) => lines.push(`@source inline(${JSON.stringify(s)});`)

// Colour utilities. The three that carry the design language get the full
// state range; the rest are base-only — states on them are vanishingly rare
// and each variant multiplies the whole colour table.
push(`{,hover:,focus:,focus-visible:,active:,disabled:,group-hover:}{bg,text,border}-${list(colors)}`)
push(`{ring,fill,stroke,outline,accent,caret,divide,placeholder}-${list(colors)}`)
// Alpha steps — `bg-negative/10` is a distinct utility, not derived at runtime.
push(`{bg,text,border,ring}-${list(colors)}/{5,10,20,30,40,50,60,70,80,90}`)
// Spacing scale across every axis utility that consumes it.
push(`{,sm:,md:,lg:,xl:}{p,px,py,pt,pr,pb,pl,m,mx,my,mt,mr,mb,ml,gap,gap-x,gap-y,space-x,space-y,w,h,size,min-w,min-h,max-w,max-h,top,right,bottom,left,inset,inset-x,inset-y,translate-x,translate-y,scroll-m,scroll-p}-${list(spacing)}`)
push(`{,sm:,md:,lg:,xl:}rounded{,-t,-b,-l,-r,-tl,-tr,-bl,-br}-${list(radius)}`)
push(`{,sm:,md:,lg:,xl:}text-${list(text)}`)
if (shadow.length) push(`shadow-${list(shadow)}`)
// Tailwind's own default scales. The design agent reaches for `p-4`/`gap-6`/
// `text-sm` by habit; without these compiled in, that markup renders with NO
// spacing at all. The numeric spacing scale is 4px-based like Sikaloc's own
// tokens, so it stays on-rhythm — the token names remain the documented idiom.
const nums = '{0,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,10,12,14,16,20,24,32}'
push(`{p,px,py,pt,pr,pb,pl,m,mx,my,mt,mr,mb,ml,gap,gap-x,gap-y,space-x,space-y,w,h,size,min-w,min-h,max-w,max-h,top,right,bottom,left,inset}-${nums}`)
push('text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl}')
push('{w,h,min-w,max-w,min-h,max-h}-{full,screen,auto,fit,min,max,px,dvh,svh}')
push('{,sm:,md:,lg:,xl:}{block,inline-block,inline,flex,inline-flex,grid,inline-grid,hidden,contents,table}')
push('{,sm:,md:,lg:,xl:}{flex-row,flex-col,flex-wrap,flex-nowrap,flex-1,flex-auto,flex-none,flex-initial,shrink,shrink-0,grow,grow-0}')
push('{,sm:,md:,lg:,xl:}{items,justify,self,content,place-items,place-content}-{start,end,center,between,around,evenly,stretch,baseline}')
push('{,sm:,md:,lg:,xl:}grid-cols-{1,2,3,4,5,6,7,8,9,10,11,12,none,subgrid}')
push('{,sm:,md:,lg:,xl:}col-span-{1,2,3,4,5,6,7,8,9,10,11,12,full}')
push('{,sm:,md:,lg:,xl:}{text-left,text-center,text-right,text-justify}')
push('font-{thin,extralight,light,normal,medium,semibold,bold,extrabold,black}')
push('{tracking,leading}-{tighter,tight,normal,snug,relaxed,loose,wide,wider,widest,none}')
push('{relative,absolute,fixed,sticky,static}')
push('{overflow,overflow-x,overflow-y}-{auto,hidden,visible,scroll,clip}')
push('{border,border-x,border-y,border-t,border-r,border-b,border-l}{,-0,-2,-4,-8}')
push('{rounded,rounded-t,rounded-b,rounded-l,rounded-r,rounded-tl,rounded-tr,rounded-bl,rounded-br}{,-none,-full}')
push('{shadow,shadow-xs,shadow-sm,shadow-md,shadow-lg,shadow-xl,shadow-2xl,shadow-none,shadow-inner}')
push('{opacity,z}-{0,5,10,20,25,30,40,50,60,70,75,80,90,95,100}')
push('{truncate,uppercase,lowercase,capitalize,normal-case,italic,not-italic,underline,line-through,no-underline,antialiased,tabular-nums,sr-only}')
push('{cursor-pointer,cursor-default,cursor-not-allowed,pointer-events-none,pointer-events-auto,select-none,transition,transition-colors,transition-all,duration-150,duration-200,duration-300}')
push('{mx-auto,my-auto,ml-auto,mr-auto,inset-0,whitespace-nowrap,break-words,list-none,object-cover,object-contain,aspect-square,aspect-video}')

// The component-class layer authored in globals.css — @layer components rules
// are only emitted when Tailwind sees them used.
push(
  '{btn,btn-primary,btn-secondary,btn-tertiary,btn-danger,btn-sm,btn-icon,input,field-label,field-hint,field-error,' +
    'card,card-lg,card-sage,card-dark,badge,badge-positive,badge-warning,badge-negative,badge-neutral,' +
    'data-table,sidebar-row,sidebar-row-active,tabular,no-scrollbar,print-hidden,' +
    // Classes apportées par DESIGN-Sikaloc.md, sans composant React associé.
    'top-nav,hero-band,hero-illustration-card,feature-card,model-comparison-card,connector-tile,' +
    'product-mockup-card-dark,code-window-card,cookie-consent-card,pricing-tier-card,' +
    'pricing-tier-card-featured,callout-card-coral,cta-band-coral,cta-band-dark,footer,' +
    'badge-pill,badge-coral,category-tab,category-tab-active,button-secondary-on-dark,text-link}',
)

// next/font defines --font-inter on <html> at runtime. Nothing does that here,
// and `var(--font-inter)` with no fallback makes the whole --font-sans value
// invalid at computed-value time — body would fall back to the UA serif in
// every rendered design. Bind it to the family fonts.css actually ships.
const fontVar = ''  // la couche de thème définit --font-inter et --font-sans

const wrapper = `@import "./src/app/globals.css";\n@import "./.design-sync/theme-sikaloc.css";\n@source "./src";\n${lines.join('\n')}\n${fontVar}\n`

const result = await postcss([tailwind()]).process(wrapper, { from: resolve(ROOT, '.tw-entry.css'), to: OUT })
writeFileSync(OUT, result.css)
console.error(
  `styles.css: ${(result.css.length / 1024).toFixed(0)} KB — ` +
    `${colors.length} colors, ${spacing.length} spacing, ${radius.length} radii, ${text.length} type steps`,
)
