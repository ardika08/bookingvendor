
import * as solid from '@hugeicons-pro/core-solid-rounded'
const set = new Set(Object.keys(solid))
const cands = [
  'Sparkles','Star','Crown','Award','BadgeCheck','Ticket','Gift','Tag','Rocket','Zap',
  'Fire','Medal','Diamond','Gem','CreditCard','Wallet','Calendar','Clock','Timer',
  'Hourglass','Ticket01','Ticket02','Membership','Vip','Subscription','Invoice','Money',
  'ShoppingBag','ShoppingCart','Package','Box','Cube','Coins','Banknote','Receipt',
  'CheckmarkBadge','Badge','Verified','Certificate','License','Key','Lock','Unlock',
  'Star','Stars','MagicWand','Wand','Lightbulb','Idea','Bulb','Crown','Trophy'
]
const ada = cands.filter(c => set.has(c + 'Icon'))
console.log('TERSEDIA:', ada.join(', '))
