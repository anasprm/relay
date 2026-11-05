module.exports=[[74762,a=>{var b=a.i(80516),c=a.i(42945),d=a.i(11653),e=a.i(6827),f=a.i(34499);let g=`(window.__RELAY_BOOTSTRAP__ = ${JSON.stringify({conversations:[],user:null})});`,h=`
(function () {
  try {
    var host = location.hostname;
    var site =
      host.indexOf('valiyakath') === 0
        ? 'whatsapp'
        : host.indexOf('relay-messengerpro') === 0
          ? 'formal'
          : 'whatsapp';
    document.documentElement.dataset.site = site;

    var storedTheme = localStorage.getItem('relay.theme');
    var dark = storedTheme
      ? storedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

    var storedUi = localStorage.getItem('relay.ui');
    var ui =
      storedUi === 'minimal' || storedUi === 'official'
        ? storedUi
        : site === 'formal'
          ? 'minimal'
          : 'official';
    document.documentElement.dataset.ui = ui;
  } catch (error) {}
})();
`;a.s(["default",0,function({children:a}){return(0,b.jsxs)("html",{lang:"en",suppressHydrationWarning:!0,children:[(0,b.jsxs)("head",{children:[(0,b.jsx)("script",{dangerouslySetInnerHTML:{__html:h}}),(0,b.jsx)("script",{dangerouslySetInnerHTML:{__html:g}})]}),(0,b.jsx)("body",{className:"min-h-screen bg-app text-ink antialiased",children:(0,b.jsx)(d.ThemeProvider,{children:(0,b.jsx)(e.UiStyleProvider,{children:(0,b.jsx)(c.AuthProvider,{children:(0,b.jsx)(f.ToastProvider,{children:a})})})})})]})},"metadata",0,{title:{default:"Relay — Secure Workspace Messaging",template:"%s · Relay"},description:"Relay is a focused realtime messaging workspace with direct threads, voice and video notes, secure calls, and server-side privacy controls.",applicationName:"Relay",authors:[{name:"Muhammed Anas.v"}],creator:"Muhammed Anas.v"},"viewport",0,{width:"device-width",initialScale:1,maximumScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#eef1f4"},{media:"(prefers-color-scheme: dark)",color:"#0b141a"}]}])},32518,a=>{var b=a.i(261);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call AuthProvider() from the server but AuthProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/AuthProvider.tsx","AuthProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call consumeAuthNotice() from the server but consumeAuthNotice is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/AuthProvider.tsx","consumeAuthNotice"),(0,b.registerClientReference)(function(){throw Error("Attempted to call errorMessage() from the server but errorMessage is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/AuthProvider.tsx","errorMessage"),(0,b.registerClientReference)(function(){throw Error("Attempted to call useAuth() from the server but useAuth is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/AuthProvider.tsx","useAuth"),a.s(["AuthProvider",0,c])},42945,a=>{var b=a.i(32518);a.n(b)},33071,a=>{var b=a.i(261);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call ThemeProvider() from the server but ThemeProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/ThemeProvider.tsx","ThemeProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call useTheme() from the server but useTheme is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/ThemeProvider.tsx","useTheme"),a.s(["ThemeProvider",0,c])},11653,a=>{var b=a.i(33071);a.n(b)},44306,a=>{var b=a.i(261);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call ToastProvider() from the server but ToastProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/ToastProvider.tsx","ToastProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call useToast() from the server but useToast is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/ToastProvider.tsx","useToast"),a.s(["ToastProvider",0,c])},34499,a=>{var b=a.i(44306);a.n(b)},52777,a=>{var b=a.i(261);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call UiStyleProvider() from the server but UiStyleProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/UiStyleProvider.tsx","UiStyleProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call useUiStyle() from the server but useUiStyle is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/web/lib/UiStyleProvider.tsx","useUiStyle"),a.s(["UiStyleProvider",0,c])},6827,a=>{var b=a.i(52777);a.n(b)}],98556,function(a){a.n(a.i(74762))}];

//# sourceMappingURL=web_14cmvnd_avy3v._.js.map