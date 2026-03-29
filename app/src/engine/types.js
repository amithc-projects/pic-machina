/**
 * ImageChef — Shared type documentation (JSDoc shapes)
 *
 * @typedef {'text'|'number'|'boolean'|'select'|'color'|'range'} ParamType
 *
 * @typedef {Object} ParamDef
 * @property {string}    name
 * @property {string}    label
 * @property {ParamType} type
 * @property {*}         [defaultValue]
 * @property {Array<{label:string,value:*}>} [options]  — for select
 * @property {number}    [min]
 * @property {number}    [max]
 * @property {number}    [step]
 *
 * @typedef {Object} TransformDef
 * @property {string}     id
 * @property {string}     name
 * @property {string}     description
 * @property {string}     category      — e.g. 'Geometric', 'Color & Tone'
 * @property {string}     categoryKey   — e.g. 'geo', 'color', 'overlay', 'ai', 'flow', 'meta'
 * @property {string}     icon          — Material Symbols name
 * @property {ParamDef[]} params
 * @property {Function}   apply         — async (ctx, params, context) => void
 *
 * @typedef {Object} TransformContext
 * @property {HTMLImageElement} originalImage
 * @property {string}           filename
 * @property {string}           [ext]
 * @property {Object}           [exif]         — raw EXIF fields
 * @property {Object}           [meta]         — generic metadata
 * @property {Map<string,ImageData>} variables  — save/load point store
 * @property {string}           [outputSubfolder]
 *
 * @typedef {Object} RecipeNode
 * @property {string}    id
 * @property {'transform'|'branch'|'conditional'|'block-ref'} type
 * @property {string}    [transformId]   — when type==='transform'
 * @property {string}    [blockId]       — when type==='block-ref'
 * @property {Object}    [params]
 * @property {string}    [label]
 * @property {boolean}   [disabled]
 * @property {Condition} [condition]
 * @property {Branch[]}  [branches]      — when type==='branch'
 * @property {RecipeNode[]} [thenNodes]  — when type==='conditional'
 * @property {RecipeNode[]} [elseNodes]
 *
 * @typedef {Object} Branch
 * @property {string}       id
 * @property {string}       label
 * @property {RecipeNode[]} nodes
 *
 * @typedef {Object} Condition
 * @property {string} field     — 'width'|'height'|'aspectRatio'|'exif.X'|'meta.X'|'HasGPS'|'IsPortrait'|'MetaExists'
 * @property {string} operator  — 'eq'|'neq'|'gt'|'lt'|'gte'|'lte'|'contains'|'exists'
 * @property {*}      value
 *
 * @typedef {Object} ProcessResult
 * @property {Blob}   blob
 * @property {string} filename
 * @property {string} [aggregationId]
 * @property {string} [subfolder]
 */

// This file is documentation-only. No runtime exports needed.
export default {};
