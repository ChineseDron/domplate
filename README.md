# domplate 简介

domplate，名字意为 dom template，是一个基于 dom 结构的前端模板控制器。

网站地址：[http://ucren.com/domplate](http://ucren.com/domplate)

## 一些特点

- 兼容 IE8 浏览器：国内市场的需求
- 实现视图最小范围更新：数据没变时，相应的 dom 节点不会更新
- 实现部分流程控制属性
- 与 web-components 无关
- 与数据双向绑定无关

## 看看 DEMO 先

``` html
<div id="demo">
  <p>计数: ‌{{ count }}‍</p>
  <p>输入：<input type="text" value="‌{{ count }}‍" onkeyup=" ‌$this.data.count‍ = this.value; "></p>
  <p>
    <button onclick=" ‌$this.data.count‍ ++; ">增加</button>
    <button onclick=" ‌$this.data.count‍ --; ">减少</button>
  </p>
</div>

<script>
  domplate( "#demo" ).load( { count: 0 } );
</script>
```
demo: [http://ucren.com/domplate/examples/event.html](http://ucren.com/domplate/examples/event.html)

另一个 Demo 实现了简单的 todo，可以帮助你更加系统的了解 domplate 的功能：

todo demo: [http://ucren.com/domplate/examples/todo.html](http://ucren.com/domplate/examples/todo.html)

移步这里了解更多：[http://ucren.com/domplate](http://ucren.com/domplate)
