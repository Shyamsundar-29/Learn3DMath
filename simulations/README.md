# Adding a topic simulation

1. Create an HTML file in a chapter folder, for example `simulations/chapter-02/dot-product.html`.
2. In `data/library.js`, find the topic and change its `simulation` value to that file path.

Example:

```js
{ id: "vectors-dot-product", title: "The Dot Product", simulation: "simulations/chapter-02/dot-product.html" }
```

The main page loads that HTML file automatically when you click the topic.
