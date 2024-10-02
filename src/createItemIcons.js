import { BlockDefinition, BlockModel, Identifier, ItemRenderer, TextureAtlas, upperPowerOfTwo } from "deepslate";
import createContext from "gl";

import Jimp from "jimp";

const MCMETA = 'https://raw.githubusercontent.com/misode/mcmeta/'

const IMAGE_SIZE = 128

const itemGl = createContext(IMAGE_SIZE, IMAGE_SIZE)
const itemRenderer = await initalize(itemGl)

async function initalize(itemGl) {
    const [blockstates, models, uvMap] = await Promise.all([
        fetch(`${MCMETA}summary/assets/block_definition/data.min.json`).then(r => r.json()),
        fetch(`${MCMETA}summary/assets/model/data.min.json`).then(r => r.json()),
        fetch(`${MCMETA}atlas/all/data.min.json`).then(r => r.json()),
    ])
    const blockDefinitions = {}
    Object.keys(blockstates).forEach(id => {
        blockDefinitions['minecraft:' + id] = BlockDefinition.fromJson(blockstates[id])
    })

    const blockModels = {}
    Object.keys(models).forEach(id => {
        blockModels['minecraft:' + id] = BlockModel.fromJson(models[id])
    })
    Object.values(blockModels).forEach((m) => m.flatten({ getBlockModel: (id) => blockModels[id] }))



    const atlas = (await Jimp.read(`${MCMETA}atlas/all/atlas.png`))
    
    const atlasSize = upperPowerOfTwo(Math.max(atlas.bitmap.width, atlas.bitmap.height))
    atlas.contain(atlasSize, atlasSize, Jimp.VERTICAL_ALIGN_TOP | Jimp.HORIZONTAL_ALIGN_LEFT)

    const idMap = {}
    Object.keys(uvMap).forEach(id => {
        const [u, v, du, dv] = uvMap[id]
        const dv2 = (du !== dv && id.startsWith('block/')) ? du : dv
        idMap['minecraft:' + id] = [u / atlasSize, v / atlasSize, (u + du) / atlasSize, (v + dv2) / atlasSize]
    })
    const textureAtlas = new TextureAtlas(atlas.bitmap, idMap)

    const resources = {
        getBlockDefinition(id) { return blockDefinitions[id.toString()] },
        getBlockModel(id) { return blockModels[id.toString()] },
        getTextureUV(id) { return textureAtlas.getTextureUV(id) },
        getTextureAtlas() { return textureAtlas.getTextureAtlas() },
        getBlockFlags(id) { return { opaque: false } },
        getBlockProperties(id) { return null },
        getDefaultBlockProperties(id) { return null },
    }

    // === Item rendering ===


    return new ItemRenderer(itemGl, Identifier.parse('stone'), resources)
}

export async function renderItem(item) {
    itemGl.clearColor(0, 0, 0, 0)
    itemGl.clear(itemGl.DEPTH_BUFFER_BIT | itemGl.COLOR_BUFFER_BIT)
    itemRenderer.setItem(item)
    itemRenderer.drawItem()

    const pixels = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4)
    itemGl.readPixels(0, 0, IMAGE_SIZE, IMAGE_SIZE, itemGl.RGBA, itemGl.UNSIGNED_BYTE, pixels)

    new Jimp({data: pixels, width: IMAGE_SIZE, height: IMAGE_SIZE}).flip(false, true).write(`icons/item/${item.path}.png`)
}

const items = await fetch(`${MCMETA}registries/item/data.min.json`).then(r => r.json())

for (const item of items){
    renderItem(Identifier.create(item))
}