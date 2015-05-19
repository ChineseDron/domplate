/**
 * domplate.js
 * @author dron
 * @version 0.1.0
 * @create 2015-04-10
 */

void function( global, doc, trim, each, eachReverse, forin, copy, clone, equal, handle, createStyleSheet, classie, attr, tmpl, klass, noop, templates ){
  "use strict";

  var prefixAttrNameSign = /^d-/;
  var eventSign = /^(d-)?on[a-z]+$/i;
  var expressionSign = /\{\{[\s\S]+?\}\}|\\[\{\}]/;

  /**
   * Controller
   */
  
  var Controller = klass( function Controller( rootElement ){
    this.rootElement = rootElement;
    this.handleId = handle( this );
    compile( this );

    if( this.initData !== null )
      this.load( this.initData );
  } )

  .methods( {
    scopes: null,
    initData: null,
    data: null,
    handleId: null,
    _updateInvoked: 0,

    load: function( data ){
      this.data = data;
      this.update();
      return this;
    },

    methods: function(){
      var bindUpdate = function( fn ){
        return function(){
          fn.apply( this, arguments );
          this.update();
          return this;
        };
      };

      return function( methods ){
        forin( methods, function( method, name ){
          this[ name ] = bindUpdate( method );
        }, this );

        return this;
      }
    }(),

    update: function(){
      this._updateInvoked ++;
      this.scopes.update( this.data );
    }
  } );

  /**
   * Base
   */
  
  var Base = klass( function Base( node, controller, attributeName, value ){
    this.node = node;
    this.ownCtrl = controller;

    if( attributeName ){
      if( prefixAttrNameSign.test( attributeName ) )
        attr( node, attributeName, null ),
        attributeName = attributeName.replace( prefixAttrNameSign, "" );
      
      this.name = attributeName;
    }
    
    if( value )
      this.set( value );
  } )

  .methods( {
    parentScope: null,
    subScopes: null,
    lastValue: null,

    set: function( templateString ){
      this.template = tmpl( templateString );
    },

    get: function( data, fn ){
      var value = this.template( data );

      if( this.lastValue != value )
        fn.call( this, this.lastValue = value );

      return value;
    },

    update: function( data ){
      this.get( data, this.change );
    }
  } );

  /**
   * ExpressionContent
   */
  
  var ExpressionContent = Base.extend( {
    type: "ExpressionContent",

    change: function( value ){
      this.node.nodeValue = value;
    }
  } );

  /**
   * ExpressionAttribute
   */
  
  var ExpressionAttribute = Base.extend( {
    type: "ExpressionAttribute",

    change: function( value ){
      attr( this.node, this.name, value === "" ? null : value );
    }
  } );

  /**
   * EventAttribute
   */
  
  var EventAttribute = Base.extend( {
    type: "EventAttribute",

    change: function( value ){
      attr( this.node, this.name, EventAttribute.eventWrapper( {
        controllerHandleId: this.ownCtrl.handleId, value: value
      } ) );
    }
  } )

  .statics( {
    eventWrapper: tmpl( [
      "void function(){ ",
        "var __ctrl = domplate.handle({{ controllerHandleId }}); ",
        "var __lastUpdateInvoked = __ctrl._updateInvoked; ",
        "void function( $this, __ctrl, __lastUpdateInvoked ){ ",
          "{{ value }} ",
        "}.call( this, __ctrl ); ",
        "if( __lastUpdateInvoked === __ctrl._updateInvoked ) ",
          "__ctrl.update(); ",
      "}.call( this );"
    ] )
  } );

  /**
   * Scope
   */
  
  var Scope = Base.extend( function Scope( node, controller ){
    this.attributes = [];
    this.parentNode = node.parentNode;
    this.setup();
  } )

  .methods( {
    placeholderNode: null,

    extractAttr: function( name ){
      var value = attr( this.node, name );
      attr( this.node, name, null );
      return value;
    },

    initPlaceholder: function(){
      var placeholder, parentNode;

      placeholder = this.placeholderNode = doc.createTextNode( "" );
      parentNode = this.node.parentNode;
      parentNode.insertBefore( placeholder, this.node );
      parentNode.removeChild( this.node );
    },

    setup: function(){
      var nodeAttrs = this.node.attributes, name, value, A;

      eachReverse( nodeAttrs, function( nodeAttr ){
        name = nodeAttr.name;
        value = nodeAttr.value;

        if( eventSign.test( name ) )
          A = EventAttribute;
        else if( expressionSign.test( value ) )
          A = ExpressionAttribute;

        if( A ){
          this.attributes.push(
            new A( this.node, this.ownCtrl, name, value ) );
          attr( this.node, name, null );
          A = null;
        }
      }, this );
    },

    update: function( data ){
      each( this.attributes, function( attribute ){
        attribute.update( data );
      } );
    },

    updateChilds: function( data ){
      each( this.subScopes, function( scope ){
        scope.update.apply( scope, this );
      }, arguments );
    }
  } );

  /**
   * ShowScope
   */
  
  var ShowScope = Scope.extend( {
    type: "ShowScope",
    extract: null,
    lastValue: null,

    setup: function(){
      this.supr();
      this.extract = createExtractFunction( this.extractAttr( "show" ) );
    },

    update: function( data ){
      var value = this.extract( data );

      this.supr( data );

      if( this.lastValue !== value ){
        classie[ value ? "remove" : "add" ]( this.node, "domplate-hide" );
        this.lastValue = value;
      }

      if( value )
        this.updateChilds( data );
    }
  } );

  /**
   * RepeatScope
   */
  
  var RepeatScope = Scope.extend( {
    type: "RepeatScope",
    itemName: null,
    extractCollection: null,

    setup: function(){
      var repeat, itemName, collectionName;
      
      this.itemDatas = [];
      this.itemNodes = [];

      this.supr();

      repeat = this.extractAttr( "repeat" ).split( " in " );
      this.itemName = trim( repeat[ 0 ] );
      this.extractCollection = createExtractFunction( trim( repeat[ 1 ] ) );
      this.initPlaceholder();
    },

    update: function( data ){
      var length = 0, itemNodes, i, l, parentNode = this.parentNode;

      parentNode.insertBefore( this.node, this.placeholderNode );

      itemNodes = this.itemNodes;

      forin( this.extractCollection( data ), function( item, index ){
        var originItemData, itemData, originNode, cloneNode;

        length ++;
        originItemData = this.itemDatas[ index ];

        if( equal( originItemData, item ) )
          return ;

        itemData = copy( data );
        itemData[ this.itemName ] = item;
        itemData[ "$index" ] = index;
        
        this.supr( itemData );
        this.updateChilds( itemData );

        cloneNode = clearHide( this.node.cloneNode( true ) );
        originNode = itemNodes[ index ];
        parentNode.insertBefore( cloneNode, originNode || this.node );

        if( originNode )
          parentNode.removeChild( originNode );

        itemNodes[ index ] = cloneNode;
        this.itemDatas[ index ] = clone( item );
      }, this );

      i = length;
      l = itemNodes.length;

      if( i < l ){
        for( ; i < l; i ++ )
          parentNode.removeChild( itemNodes[ i ] );
        itemNodes.length = this.itemDatas.length = length;
      }

      parentNode.removeChild( this.node );
    }
  } );

  /**
   * SwitchScope
   */
  
  var SwitchScope = Scope.extend( {
    type: "SwitchScope",
    extract: null,
    switchValue: null,
    caseMatch: 0,

    setup: function(){
      this.supr();
      this.extract = createExtractFunction( this.extractAttr( "switch" ) );
    },

    update: function( data ){
      this.supr( data );
      this.switchValue = this.extract( data ).toString();
      this.caseMatch = 0;
      this.updateChilds( data );
    }
  } );

  /**
   * CaseScope
   */
  
  var CaseScope = Scope.extend( {
    type: "CaseScope",
    parentSwitch: null,
    value: null,

    setup: function(){
      this.supr();
      this.value = this.extractAttr( "case" );
    },

    update: function( data ){
      var p = this.parentSwitch;

      if( this.value === p.switchValue )
        this.supr( data ),
        classie.remove( this.node, "domplate-hide" ),
        p.caseMatch ++,
        this.updateChilds( data );
      else
        classie.add( this.node, "domplate-hide" );
    },

    onParentScopeSpecified: function(){
      var p = this.parentScope;

      while( p ){
        if( p.type == "SwitchScope" ){
          this.parentSwitch = p;
          break;
        }

        p = p.parentScope;
      }
    }
  } );

  /**
   * DefaultScope
   */
  
  var DefaultScope = CaseScope.extend( {
    type: "DefaultScope",

    setup: function(){
      this.supr();
    },

    update: function( data ){
      if( this.parentSwitch.caseMatch === 0 ){
        this.supr( data );
        classie.remove( this.node, "domplate-hide" );
        this.updateChilds( data );
      }else{
        classie.add( this.node, "domplate-hide" );
      }
    }
  } );

  /**
   * SkipScope
   */
  
  var SkipScope = Scope.extend( {
    type: "SkipScope",

    setup: function(){
      this.supr();
    },

    update: function( data ){
      this.supr( data );
      this.updateChilds( data );
    }
  } );

  /**
   * Compiler
   */
  
  var Compiler = klass( function Compiler(){
  } )

  .statics( {
    parseInit: function( node, controller ){
      var dataString = attr( node, "init" ), data;

      try{
        data = Function( "return " + dataString + ";" )();
        controller.initData = data;
      }catch( e ){
        throw new Error( "invalid data: " + dataString );
      }   
    }
  } )

  .methods( {
    controller: null,

    compileNode: function( node, parentScope ){
      var childs, scope, subScope, subScopes, controller = this.controller;

      if( node.isDomplateElement )
        return null;

      switch( node.nodeType ){
        case 1: // element
          node.isDomplateElement = true;

          if( attr( node, "init" ) )
            Compiler.parseInit( node, controller );

          if( attr( node, "show" ) )
            scope = new ShowScope( node, controller );
          else if( attr( node, "repeat" ) )
            scope = new RepeatScope( node, controller );
          else if( attr( node, "switch" ) )
            scope = new SwitchScope( node, controller );
          else if( attr( node, "case" ) )
            scope = new CaseScope( node, controller );
          else if( attr( node, "default" ) !== null )
            scope = new DefaultScope( node, controller );
          else
            scope = new SkipScope( node, controller );

          break;

        case 3: // text
          if( expressionSign.test( node.nodeValue ) )
            scope = new ExpressionContent( node, controller, null, node.nodeValue );

          break;

        case 8: // comment
          break;

        default:
          throw new Error( "Unknow node type" );
          break;
      }

      childs = node.childNodes;

      if( scope ){
        if( parentScope ){
          scope.parentScope = parentScope;

          if( scope.onParentScopeSpecified )
            scope.onParentScopeSpecified();
        }

        if( childs && childs.length ){
          subScopes = scope.subScopes = [];

          each( childs, function( child ){
            subScope = this.compileNode( child, scope );

            if( subScope )
              subScopes.push( subScope );
          }, this );
        }
      }

      return scope;
    },

    compile: function(){
      return this.compileNode( this.rootElement, null );
    }
  } );

  /**
   * 
   */
  
  function clearHide( node ){
    each( node.querySelectorAll( ".domplate-hide" ), function( node ){
      node.parentNode.removeChild( node );
    } );

    return node;
  }
  
  function createExtractFunction( string ){
    var template = tmpl( "{{{ domplate.__tempValue__ = ( " + string + " ); }}}" );

    return function( data ){
      var result;

      template( data );
      result = domplate.__tempValue__;
      delete domplate.__tempValue__;

      return result;
    }
  }
  
  function compile( controller ){
    var compiler = new Compiler;
    compiler.controller = controller;
    compiler.rootElement = controller.rootElement;
    controller.scopes = compiler.compile();
  }

  function domplate( element ){
    if( typeof element == "string" )
      element = doc.querySelector( element );

    if( element.domplateController )
      return element.domplateController;

    if( element.isDomplateElement )
      return null;

    return element.domplateController = new Controller( element );
  }

  function publishExternalAPI(){
    if( !global.domplate ){
      domplate.handle = handle;
      global.domplate = domplate;
    }

    if( typeof module === "object" && typeof module.exports === "object" )
      module.exports = global.domplate;
  }

  void function main(){
    if( global.domplate )
      return publishExternalAPI();

    createStyleSheet( templates.initializeCss );
    publishExternalAPI();
  }();
}

/* some dependencies */ (
  typeof window !== "undefined" ? window : this,

  document,

  function trim( string ){
    return string.trim ? string.trim() : string.replace( /^\s+|\s+$/g, "" );
  },

  function each( array, iterator, context ){
    if( array && array.length )
      for( var i = 0, l = array.length; i < l; i ++ )
        iterator.call( context, array[ i ], i );
  },

  function eachReverse( array, iterator, context ){
    if( array && array.length )
      for( var i = array.length - 1; i > -1; i -- )
        iterator.call( context, array[ i ], i );
  },

  function forin( object, iterator, context ){
    for( var i in object )
      if( object.hasOwnProperty( i ) )
        iterator.call( context, object[ i ], i );
  },

  function copy( target ){
    var result = {};

    for( var name in target )
      if( target.hasOwnProperty( name ) )
        result[ name ] = target[ name ];
    
    return result;
  },

  function clone(){
    var s = /num|str|boo|und/, f = /fun/, m = /date|rege/i;
    return function clone( json ){
      var t, i, r;

      t = typeof json;

      if( s.test( t ) || !json )
        return json;

      if( f.test( t ) )
        return new Function( "return " + json.toString() )();

      if( m.test( json.constructor ) )
        return new json.constructor( json.valueOf() );

      r = "length" in json ? [] : {};

      for( i in json )
        if( json.hasOwnProperty( i ) )
          r[ i ] = clone( json[ i ] );

      return r;
    };
  }(),

  function equal(){
    var s = /num|str|boo|fun/, f = /fun/, m = /regx|date/i;
    return function equal( a, b ){
      var t, i, c;

      t = typeof a;

      if( a === b )
        return true;

      if( t !== typeof b )
        return false;

      if( a !== a && b !== b )
        return true;

      if( s.test( t ) || !a || !b )
        return a === b;

      if( f.test( t ) || m.test( a.constructor ) )
        return a.toString() === b.toString();

      c = {};

      for( i in a )
        if( a.hasOwnProperty( i ) )
          if( c[ i ] = 1, !equal( a[ i ], b[ i ] ) )
            return false;

      for( i in b )
        if( !c[ i ] && b.hasOwnProperty( i ) )
          if( !equal( a[ i ], b[ i ] ) )
            return false;

      return true;
    }
  }(),

  function handle(){
    var cache = {}, number = 0;

    return function( unknown ){    
      switch( typeof( unknown ) ){
        case "number":
          return cache[ unknown.toString() ];
          break;
        case "object":
        case "function":
          cache[ ( ++number ).toString() ] = unknown;
          return number;
          break;
      }
    }
  }(),

  function createStyleSheet( content, doc ){
    var contentJson, selector, rules, rule, style;

    if( typeof content == "object" ){
      contentJson = content;
      content = [];

      for( selector in contentJson )
        if( contentJson.hasOwnProperty( selector ) ){
          rules = contentJson[ selector ];
          content.push( selector, "{" );

          for( rule in rules )
            if( rules.hasOwnProperty( rule ) )
              content.push( rule, ":", rules[ rule ], ";" );

          content.push( "}" );
        }

      content = content.join( "" );
    }

    if( !doc )
      doc = document;

    if( doc.createStyleSheet ){
      style = doc.createStyleSheet();
      style.cssText = content;
    }else{
      style = doc.createElement( "style" );
      style.type = "text/css";
      style.appendChild( doc.createTextNode( content ));
      doc.getElementsByTagName( "head" )[ 0 ].appendChild( style );
    }
  },

  function classie(){
    var hasClass, addClass, removeClass;

    function classReg( className ){
      return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
    }

    if( "classList" in document.documentElement ){
      hasClass = function( elem, c ){
        return elem.classList.contains( c );
      };
      addClass = function( elem, c ){
        elem.classList.add( c );
      };
      removeClass = function( elem, c ){
        elem.classList.remove( c );
      };
    }else{
      hasClass = function( elem, c ){
        return classReg( c ).test( elem.className );
      };
      addClass = function( elem, c ){
        if( !hasClass( elem, c ) )
          elem.className = elem.className + " " + c;
      };
      removeClass = function( elem, c ){
        elem.className = elem.className.replace( classReg( c ), " " );
      };
    }

    function toggleClass( elem, c ){
      ( hasClass( elem, c ) ? removeClass : addClass )( elem, c );
    }

    return {
      hasClass: hasClass,
      addClass: addClass,
      removeClass: removeClass,
      toggleClass: toggleClass,
      has: hasClass,
      add: addClass,
      remove: removeClass,
      toggle: toggleClass
    };
  }(),

  function attr(){
    var i, b, hooks, booleans, falsy;

    booleans = "checked,selected,async,autofocus,autoplay,controls,defer," +
      "disabled,hidden,ismap,loop,multiple,open,readonly,required,scoped";

    booleans = booleans.split( "," );
    falsy = /^(0|NaN|false|undefined|null|\s*)$/;

    hooks = {
      type: {
        set: function( elem, value, val ){
          if( value == "radio" && elem.nodeName.toLowerCase() == "input" ){
            val = elem.value;
            elem.setAttribute( "type", value );
            val ? elem.value = val : 0;
          }else{
            return false;
          }
        }
      },

      style: {
        get: function( elem ){
          return elem.style.cssText || undefined;
        },

        set: function( elem, value ){
          elem.style.cssText = value + "";
        }
      },

      value: {
        get: function( elem ){
          if( elem.nodeName.toLowerCase() == "input" )
            return elem.value;
          else
            return elem.getAttribute( "value" );
        },

        set: function( elem, value ){
          if( elem.nodeName.toLowerCase() == "input" )
            elem.value = value;
          else
            return false;
        }
      }
    };

    for( i = 0; b = booleans[ i ]; i ++ ){
      hooks[ b ] = {
        set: function( elem, value, name ){
          if( falsy.test( value ) )
            elem.removeAttribute( name ),
            elem[ name ] = false;
          else
            elem.setAttribute( name, name ),
            elem[ name ] = true;
        }
      }
    }

    return function attr( elem, name, value, hook ){
      if( !elem || /^[238]$/.test( elem.nodeType ) )
        return ;

      if( value === null )
        return elem.removeAttribute( name );

      if( hook = hooks[ name ], typeof value !== "undefined" ){
        if( hook && hook.set && hook.set( elem, value, name ) !== false )
          return value;
        else
          return elem.setAttribute( name, value + "" ), value;
      }else{
        return hook && hook.get ? 
          hook.get( elem ) : elem.getAttribute( name );
      }
    }
  }(),

  function tmpl(){
    var literals, settings, matcher, escaper, escapes;

    literals = /\\([\{\}])|\u200c([^\u200d])\u200d/g;
    settings = { evaluate: /\{\{\{([\s\S]+?)\}\}\}/g, interpolate: /\{\{([\s\S]+?)\}\}/g };
    matcher = new RegExp( settings.evaluate.source + "|" + settings.interpolate.source + "|$", "g" );

    escaper = /\\|"|\r|\n|\t|\u2028|\u2029/g;
    escapes = {
      "\"": "\"", "\\": "\\", "\r": "r", "\n": "n", "\t": "t",
      "\u2028": "u2028", "\u2029": "u2029"
    };

    return function tmpl( text, data ){
      var render, index, source, template;

      index = 0;

      source = "_p_p_ = \"";

      if( text instanceof Array )
        text = text.join( "" );

      text = text.replace( literals, "\u200c$1\u200d" );

      text.replace( matcher, function( match, evaluate, interpolate, offset ){
        source += text.slice( index, offset ).replace( escaper, function( match ){
          return "\\" + escapes[ match ];
        } );

        if( evaluate )
          source += "\"; " + evaluate + "; _p_p_ += \"";

        if( interpolate )
          source += "\" + ( ( _t_t_ = ( " + interpolate + " ) ) == null ? \"\" : _t_t_ ) + \"";

        index = offset + match.length;
        return match;
      } );

      source = source.replace( literals, "$2" );
      source = "var _t_t_, _p_p_; with( _d_d_ || {} ){ " + source + "\"; } return _p_p_;";

      try{
        render = new Function( "_d_d_", source );
      }catch( e ){
        e.source = source;
        throw e;
      }

      if( data )
        return render( data );

      template = function( data ) {
        return render.call( this, data );
      };

      template.source = "function( _d_d_ ){ " + source + " }";

      return template;
    }
  }(),

  function klass(){
    var context = this, f = "function", 
        fnTest = /xyz/.test( function(){ xyz } ) ? /\bsupr\b/ : /.*/,
        proto = "prototype";

    function klass( o ){
      return extend.call( isFn( o ) ? o : function(){}, o, 1 );
    }

    function isFn( o ){
      return typeof o === f;
    }

    function wrap( k, fn, supr ){
      return function(){
        var tmp = this.supr;
        var undef = {}.fabricatedUndefined;
        var ret = undef;

        this.supr = supr[ proto ][ k ];

        try{
          ret = fn.apply( this, arguments );
        }finally{
          this.supr = tmp;
        }

        return ret;
      };
    }

    function process( what, o, supr ){
      for( var k in o ){
        if( o.hasOwnProperty( k ) ){
          what[ k ] = isFn( o[ k ] ) && 
          isFn( supr[ proto ][ k ] ) && 
          fnTest.test( o[ k ] ) ? wrap( k, o[ k ], supr ) : o[ k ];
        }
      }
    }

    function extend( o, fromSub ){
      function noop(){}

      noop[ proto ] = this[ proto ];

      var supr = this, prototype = new noop(), isFunction = isFn( o ),
        _constructor = isFunction ? o : this,
        _methods = isFunction ? {} : o;

      function klass(){
        if( this.initialize ){
          this.initialize.apply( this, arguments );
        }else{
          fromSub || isFunction && supr.apply( this, arguments );
          _constructor.apply( this, arguments );
        }
      }

      klass.methods = function( o ){
        process( prototype, o, supr );
        klass[ proto ] = prototype;

        return this;
      }

      klass.methods.call( klass, _methods ).prototype.constructor = klass;
      klass.extend = extend;
      klass[ proto ].implement = klass.statics = function( o, optFn ){
        o = typeof o == "string" ? function(){
          var obj = {};
          obj[ o ] = optFn;
          return obj;
        }() : o;

        process( this, o, supr );
        return this;
      }

      return klass;
    }

    return klass;
  }(),

  function noop(){},

  /* templates */ {
    initializeCss: {
      ".domplate-hide": {
        "display": "none !important"
      }
    }
  }
);