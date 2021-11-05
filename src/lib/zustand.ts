// import create from 'zustand/vanilla'
// import type { GetState, SetState, StoreApi as InternalStoreApi } from "zustand/vanilla";
// import { combine, persist } from "zustand/middleware";
// import type { Subscriber, Writable } from "svelte/store";

// type StateCreator<TState extends object, TApi extends object> = (set: SetState<TState>, get: GetState<TState>, api: InternalStoreApi<TState>) => TApi;

// type StoreApi<TState extends object, TApi extends object> = InternalStoreApi<TState & TApi & {
//   set: SetState<TState>;
//   get: GetState<TState>;
// }>;

// export const getterSetter = function <
//   TState extends object,
//   TApi extends object
// >(
//   initialState: TState,
//   creator?: StateCreator<TState, TApi>
// ): StoreApi<TState, TApi> {
//   return create(
//     combine(initialState, (set, get, api) => ({
//       set,
//       get,
//       ...(creator ? creator(set, get, api) : {}),
//     })) as any
//   );
// };

// export const writable = function <
//   TState extends {},
//   TApi extends {}
// >(
//   initialState: TState,
//   creator?: StateCreator<TState, TApi>,

// ): Writable<TState & TApi> {
//   const { getState, setState, subscribe } = create(persist(combine(initialState, creator), {
//     name: 
//   }))
//   return {
//     subscribe: function (subscription: Subscriber<TState & TApi & {
//       set: SetState<TState>;
//       get: GetState<TState>;
//     }>) {
//       subscription(getState());
//       return subscribe(subscription)
//     },
//     set: setState,
//     update: setState
//   }
// };

// export const persistedWritable = function <
//   TState extends {},
//   TApi extends {}
// >(
//   initialState: TState,
//   creator?: StateCreator<TState, TApi>
// ): Writable<TState & TApi> {
//   const { getState, setState, subscribe } = createStore(initialState, creator)
//   return {
//     subscribe: function (subscription: Subscriber<TState & TApi & {
//       set: SetState<TState>;
//       get: GetState<TState>;
//     }>) {
//       subscription(getState());
//       return subscribe(subscription)
//     },
//     set: setState,
//     update: setState
//   }
// };
