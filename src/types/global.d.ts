/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="unplugin-icons/types/svelte" />

type ObjectKeys<Obj> = Obj extends object
  ? (keyof Obj)[]
  : Obj extends number
  ? []
  : Obj extends Array<any> | string
  ? string[]
  : never;

interface ObjectConstructor {
  keys<ObjectType>(o: ObjectType): ObjectKeys<ObjectType>;
  entries<ObjType>(o: ObjType): [Unpacked<ObjectKeys<ObjType>>, ObjType[keyof ObjType]][];
}

interface Storage {
  getItem<T extends string>(key: string): T | null;
}

type Unpacked<ArrayLike> = ArrayLike extends (infer RootType)[] ? RootType : ArrayLike;

type Unpromisify<PromiseLike> = PromiseLike extends Promise<infer RootType>
  ? RootType
  : PromiseLike;

declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    'onsvelte-drag:start'?: (e: CustomEvent<null>) => void;
    'onsvelte-drag:end'?: (e: CustomEvent<null>) => void;
    'onsvelte-drag'?: (e: CustomEvent<{ offsetX: number; offsetY: number }>) => void;
  }
}

interface Array<T> {
  fill<T extends any>(value: T, start?: number | undefined, end?: number | undefined): T[];
}

declare module 'randomfill' {
  function randomFillSync<T>(buffer: T, offset: number, size: number): T;
}
