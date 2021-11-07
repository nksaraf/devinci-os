// Return our buffer depending on browser or node

import { Buffer } from 'buffer';

const isomorphicBuffer = Buffer;
export default isomorphicBuffer;
