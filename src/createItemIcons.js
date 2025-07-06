import { BlockDefinition, BlockModel, Identifier, ItemRenderer, TextureAtlas, upperPowerOfTwo, ItemModel, jsonToNbt, ItemStack } from "deepslate";
import createContext from "gl";

import Jimp from "jimp";

const MCMETA = 'https://raw.githubusercontent.com/misode/mcmeta/'

const IMAGE_SIZE = 128

const itemGl = createContext(IMAGE_SIZE, IMAGE_SIZE)
const itemRenderer = await initalize(itemGl)

async function initalize(itemGl) {
    const [blockstates, models, uvMap, item_models, item_components] = await Promise.all([
        fetch(`${MCMETA}summary/assets/block_definition/data.min.json`).then(r => r.json()),
        fetch(`${MCMETA}summary/assets/model/data.min.json`).then(r => r.json()),
        fetch(`${MCMETA}atlas/all/data.min.json`).then(r => r.json()),
        fetch(`${MCMETA}summary/assets/item_definition/data.min.json`).then(r => r.json()),
        fetch(`${MCMETA}summary/item_components/data.min.json`).then(r => r.json()),
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

    const itemModels = {}
    Object.keys(item_models).forEach(id => {
        itemModels['minecraft:' + id] = ItemModel.fromJson(item_models[id].model)
    })

    const itemComponents = {}
    Object.keys(item_components).forEach(id => {
        const components = new Map()
        Object.keys(item_components[id]).forEach(c_id => {
            components.set(c_id, jsonToNbt(item_components[id][c_id]))
        })
        itemComponents['minecraft:' + id] = components
    })


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
        getPixelSize() { return textureAtlas.getPixelSize() },
        getBlockFlags(id) { return { opaque: false } },
        getBlockProperties(id) { return null },
        getDefaultBlockProperties(id) { return null },
        getItemModel(id) { return itemModels[id.toString()] },
        getItemComponents(id) { return itemComponents[id.toString()] },
    }

    // === Item rendering ===


    return new ItemRenderer(itemGl, new ItemStack(Identifier.parse('stone'), 1), resources)
}

export async function renderItem(item) {
    itemGl.clearColor(0, 0, 0, 0)
    itemGl.clear(itemGl.DEPTH_BUFFER_BIT | itemGl.COLOR_BUFFER_BIT)
    itemRenderer.setItem(new ItemStack(item, 1))
    itemRenderer.drawItem()

    const pixels = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4)
    itemGl.readPixels(0, 0, IMAGE_SIZE, IMAGE_SIZE, itemGl.RGBA, itemGl.UNSIGNED_BYTE, pixels)

    new Jimp({ data: pixels, width: IMAGE_SIZE, height: IMAGE_SIZE }).flip(false, true).write(`icons/item/${item.path}.png`)
}

const items = await fetch(`${MCMETA}registries/item/data.min.json`).then(r => r.json())

for (const item of items) {
    renderItem(Identifier.create(item))
}