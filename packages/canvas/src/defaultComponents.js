/**
 * Default visual components shipped with Agora.
 * Users can use all, some, or none of these in their agora.config.js.
 */

import Diagram from './components/Diagram.jsx';
import HtmlContent from './components/HtmlContent.jsx';
import WebEmbed from './components/WebEmbed.jsx';

const defaultComponents = {
  'canvas:diagram': Diagram,
  'canvas:html': HtmlContent,
  'canvas:web-embed': WebEmbed,
};

export default defaultComponents;
