# JS13K Starter 2023

A starter template for the [js13kgames competition](https://js13kgames.com/).

https://github.com/codyebberson/js13k-starter-2022/assets/749094/91595ad7-9af5-4e48-9eca-1e42dbd5fd58

Demo: <https://js13k-starter-2023.vercel.app/>

Features:

- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) dev server
- [Rollup](https://rollupjs.org/guide/en/) production build
- [ZzFX](https://github.com/KilledByAPixel/ZzFX) sound effects
- [ZzFXM](https://github.com/keithclark/ZzFXM) music
- [Google Closure Compiler](https://github.com/google/closure-compiler) - best JS minifier
- [Roadroller](https://lifthrasiir.github.io/roadroller/) - best JS compressor
- [Efficient Compression Tool](https://github.com/fhanau/Efficient-Compression-Tool) - best ZIP
- [Prettier](https://prettier.io/)
- [ESLint](https://eslint.org/)

The size of this demo is 3,530 bytes, only 26% of the 13kb budget, which leaves you 9,782 bytes to add gameplay, graphics, sound, and more.

> **Warning**
> **This is an advanced starter project!** The tools will perform all kinds of crazy transformations to your code, so things will often break in mysterious ways. This project is only recommended for developers who are comfortable debugging complex tool chains.

## Usage

### Install

Clone and install dependencies:

```bash
git clone git@github.com:codyebberson/js13k-starter-2023.git
cd js13k-starter-2023
npm i
```

### Dev server

Start the dev server with hot reload:

```bash
npm run dev
```

Open your web browser to <http://localhost:3000/>

### Production build

Create a final production build:

```bash
npm run build
```

## Tools

### TypeScript

> [TypeScript](https://www.typescriptlang.org/) is a strongly typed programming language that builds on JavaScript.

The project is configured with relatively strict TypeScript settings. Tweak the configuration in `tsconfig.json`.

[TSConfig Reference](https://www.typescriptlang.org/tsconfig)

### Vite

> [Vite](https://vitejs.dev/) is a build tool that aims to provide a faster and leaner development experience for modern web projects. It consists of two major parts:
>
> A dev server that provides [rich feature enhancements](https://vitejs.dev/guide/features.html) over [native ES modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), for example extremely fast [Hot Module Replacement (HMR)](https://vitejs.dev/guide/features.html#hot-module-replacement).
>
> A build command that bundles your code with [Rollup](https://rollupjs.org/), pre-configured to output highly optimized static assets for production.
>
> You can learn more about the rationale behind the project in the [Why Vite](https://vitejs.dev/guide/why.html) section.

### Google Closure Compiler

> The [Google Closure Compiler](https://github.com/google/closure-compiler) is a tool for making JavaScript download and run faster. It is a true compiler for JavaScript. Instead of compiling from a source language to machine code, it compiles from JavaScript to better JavaScript. It parses your JavaScript, analyzes it, removes dead code and rewrites and minimizes what's left. It also checks syntax, variable references, and types, and warns about common JavaScript pitfalls.

This starter project is configured to use Closure's [ADVANCED](https://developers.google.com/closure/compiler/docs/api-tutorial3) mode, which has some important restrictions to consider. See [What to Watch Out for When Using ADVANCED_OPTIMIZATIONS](https://developers.google.com/closure/compiler/docs/api-tutorial3#dangers).

Sometimes you may need to provide additional hints to the Closure Compiler to achieve optimal performance. This is done using structured JSDoc comments. See [Annotating JavaScript for the Closure Compiler](https://github.com/google/closure-compiler/wiki/Annotating-JavaScript-for-the-Closure-Compiler).

If `ADVANCED` mode causes problems, you can change to `SIMPLE` or `WHITESPACE_ONLY` in `vite.config.ts`:

```ts
// vite.config.ts

import { js13kViteConfig } from 'js13k-vite-plugins';
import { defineConfig } from 'vite';

export default defineConfig(
  js13kViteConfig({
    closureOptions: {
      compilation_level: 'SIMPLE',
    },
  }),
);
```

Or, if you want to disable Google Closure Compiler entirely, you can use `closureOptions: false`:

```ts
// vite.config.ts

import { js13kViteConfig } from 'js13k-vite-plugins';
import { defineConfig } from 'vite';

export default defineConfig(js13kViteConfig({ closureOptions: false }));
```

### Roadroller

> [Roadroller](https://github.com/lifthrasiir/roadroller) is a heavyweight JavaScript packer for large demos. It was originally designed for [js13kGames](https://js13kgames.com/), but it remains usable for demos as small as 4KB. Depending on the input it can provide up to 15% additional compression compared to best ZIP/gzip recompressors.

Roadroller is invoked automatically during the `build` step using a custom Vite plugin. See `roadrollerPlugin` in `vite.config.ts`. The plugin automatically pipes the JS output from the previous step (Google Closure) into Roadroller, and builds an optimized HTML file.

### Efficient Compression Tool (ECT)

> [Efficient Compression Tool](https://github.com/fhanau/Efficient-Compression-Tool) (or ECT) is a C++ file optimizer. It supports PNG, JPEG, GZIP and ZIP files.

ECT is invoked automatically during the `build` step using a custom Vite plugin. See `ectPlugin` in `vite.config.ts`. The adds the build files into a highly optimized ZIP file.

**Known limitation**: Currently the list of files to include in the ZIP file must be manually updated in `vite.config.ts`.

## Acknowledgements

[Frank Force](https://twitter.com/KilledByAPixel) for [ZzFX](https://github.com/KilledByAPixel/ZzFX)

[Keith Clark](https://twitter.com/keithclarkcouk) and [Frank Force](https://twitter.com/KilledByAPixel) for [ZzFXM](https://keithclark.github.io/ZzFXM/)

[Kang Seonghoon](https://mearie.org/) for [Roadroller](https://lifthrasiir.github.io/roadroller/)

[Rob Louie](https://github.com/roblouie) for Roadroller configuration recommendations

[Salvatore Previti](https://github.com/SalvatorePreviti) for Terser configuration recommendations

Graphics: [Micro Roguelike by Kenney](https://www.kenney.nl/assets/micro-roguelike)

[Andrzej Mazur](https://end3r.com/) for organizing js13k

## License

MIT
