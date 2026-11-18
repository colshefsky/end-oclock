import '../../ui/fonts.css';
import '../../ui/theme.css';
import './popup.css';
import { renderPopup } from '../../popup/render';
import { sessionItem } from '../../shared/storage';

const app = document.getElementById('app')!;
const open = () => { void browser.runtime.openOptionsPage(); window.close(); };
const paint = async () => app.replaceChildren(renderPopup(await sessionItem.getValue(), Date.now(), open));
void paint();
sessionItem.watch(() => void paint());
