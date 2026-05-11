import { db } from './firebase'
import {
  collection, doc, getDoc, getDocs,
  setDoc, query, orderBy, limit,
  where,
} from 'firebase/firestore'

const SONGS = 'songs'

export async function getSong(id) {
  const snap = await getDoc(doc(db, SONGS, id))
  if (!snap.exists()) return null
  const data = snap.data()
  const pagesSnap = await getDocs(
    query(collection(db, SONGS, id, 'pages'), orderBy('page_num'))
  )
  data.pages = pagesSnap.docs.map(d => d.data())
  return { id: snap.id, ...data }
}

export async function listSongs({ search = '', pageSize = 50 } = {}) {
  let q
  if (search) {
    q = query(
      collection(db, SONGS),
      where('title', '>=', search),
      where('title', '<', search + ''),
      orderBy('title'),
      limit(pageSize),
    )
  } else {
    q = query(collection(db, SONGS), orderBy('title'), limit(pageSize))
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveSong(song) {
  const { id, pages, ...meta } = song
  const ref = doc(db, SONGS, id)
  await setDoc(ref, meta)
  for (const pg of pages) {
    await setDoc(doc(db, SONGS, id, 'pages', String(pg.page_num)), pg)
  }
}
