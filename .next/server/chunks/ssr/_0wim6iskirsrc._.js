module.exports=[[33290,a=>{var b=a.i(7997),c=a.i(75594),d=a.i(35411),e=a.i(73500),f=a.i(43127);let g=`(window.__RELAY_BOOTSTRAP__ = ${JSON.stringify({conversations:[],user:null})});`,h=`
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
`;a.s(["default",0,function({children:a}){return(0,b.jsxs)("html",{lang:"en",suppressHydrationWarning:!0,children:[(0,b.jsxs)("head",{children:[(0,b.jsx)("script",{dangerouslySetInnerHTML:{__html:h}}),(0,b.jsx)("script",{dangerouslySetInnerHTML:{__html:g}})]}),(0,b.jsx)("body",{className:"min-h-screen bg-app text-ink antialiased",children:(0,b.jsx)(d.ThemeProvider,{children:(0,b.jsx)(e.UiStyleProvider,{children:(0,b.jsx)(c.AuthProvider,{children:(0,b.jsx)(f.ToastProvider,{children:a})})})})})]})},"metadata",0,{title:{default:"Relay — Secure Workspace Messaging",template:"%s · Relay"},description:"Relay is a focused realtime messaging workspace with direct threads, voice and video notes, secure calls, and server-side privacy controls.",applicationName:"Relay",authors:[{name:"Muhammed Anas.v"}],creator:"Muhammed Anas.v"},"viewport",0,{width:"device-width",initialScale:1,maximumScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#eef1f4"},{media:"(prefers-color-scheme: dark)",color:"#0b141a"}]}])},14181,a=>{var b=a.i(11857);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call AuthProvider() from the server but AuthProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/AuthProvider.tsx","AuthProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call consumeAuthNotice() from the server but consumeAuthNotice is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/AuthProvider.tsx","consumeAuthNotice"),(0,b.registerClientReference)(function(){throw Error("Attempted to call errorMessage() from the server but errorMessage is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/AuthProvider.tsx","errorMessage"),(0,b.registerClientReference)(function(){throw Error("Attempted to call useAuth() from the server but useAuth is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/AuthProvider.tsx","useAuth"),a.s(["AuthProvider",0,c])},75594,a=>{var b=a.i(14181);a.n(b)},67360,a=>{var b=a.i(11857);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call ThemeProvider() from the server but ThemeProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/ThemeProvider.tsx","ThemeProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call useTheme() from the server but useTheme is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/ThemeProvider.tsx","useTheme"),a.s(["ThemeProvider",0,c])},35411,a=>{var b=a.i(67360);a.n(b)},36377,a=>{var b=a.i(11857);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call ToastProvider() from the server but ToastProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/ToastProvider.tsx","ToastProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call useToast() from the server but useToast is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/ToastProvider.tsx","useToast"),a.s(["ToastProvider",0,c])},43127,a=>{var b=a.i(36377);a.n(b)},19914,a=>{var b=a.i(11857);let c=(0,b.registerClientReference)(function(){throw Error("Attempted to call UiStyleProvider() from the server but UiStyleProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/UiStyleProvider.tsx","UiStyleProvider");(0,b.registerClientReference)(function(){throw Error("Attempted to call useUiStyle() from the server but useUiStyle is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/lib/UiStyleProvider.tsx","useUiStyle"),a.s(["UiStyleProvider",0,c])},73500,a=>{var b=a.i(19914);a.n(b)}],70864,function(a){a.n(a.i(33290))}];

//# sourceMappingURL=_0wim6iskirsrc._.js.map