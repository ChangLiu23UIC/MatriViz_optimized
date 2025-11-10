import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { ResourceFile } from '../types/types'

export const getResourceList = async (dirPath: string): Promise<ResourceFile[]> => {
  const files = await readdir(dirPath)
  const res: Array<ResourceFile> = []
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const data = await readFile(dirPath + path.sep + file, 'utf8')
        const json = JSON.parse(data)
        if (json['fileType'] === 'matriviz') {
          console.log(json as ResourceFile)
          res.push(json as ResourceFile)
        }
      } catch (err) {
        console.error(err)
      }
    }
  }
  return res
}

export const getCategories = async (path: string): Promise<Record<string, string[]>> => {
  console.log('Reading category file from:', path)
  try {
    const file = await readFile(path, 'utf8')
    const json = JSON.parse(file)
    console.log('Successfully loaded categories from:', path)
    return json
  } catch (error) {
    console.error('Error reading category file:', path, error)
    throw error
  }
}
