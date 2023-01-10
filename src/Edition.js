import React, { Component } from 'react';
import GridMap from './GridMap';
import TreeMap from './TreeMap';
import { getNews } from './GoogleNewsRSS';

import Article from './Article';


/**
 * @typedef Category
 * @prop {string} id
 * @prop {string} key
 * @prop {string} name
 * @prop {any[]} articles
 */

/**
 * @typedef EditionProps
 * @prop {string} edition
 * @prop {string} mode
 * @prop {string[]} availableCategories
 * @prop {string[]} selectedCategories
 * @prop {{[category: string]: string}} colours
 * @prop {boolean} showImages
 * @prop {number} itemsPerCategory
 * @prop {number} refreshTime
 * @prop {boolean} newTab
 */

/**
 * @typedef EditionState
 * @prop {Category[]} categories
 */

/**
 * @augments Component<EditionProps, EditionState>
 */
class Edition extends Component {
  constructor (props) {
    super(props);

    /** @type {EditionState} */
    this.state = {
      categories: [],
    };

    this.handleItemClick = this.handleItemClick.bind(this);
  }

  handleItemClick (e, item) {
    if (e.altKey) {
      e.preventDefault();

      if (!item.sources) {
        return;
      }

      item.sources.push(item.sources.shift());

      item.title = item.sources[0].title;
      item.url = item.sources[0].url;

      this.forceUpdate();

      return;
    }
  }

  componentDidMount () {
    this.loadAllCategories(this.props.edition);

    if (window['ga']) {
      window['ga']('send', 'pageview', { "dimension1": this.props.edition });
    }

    this.timeout = setInterval(() => this.loadAllCategories(this.props.edition), this.props.refreshTime);
  }

  componentWillUnmount () {
    clearInterval(this.timeout);
  }

  componentDidUpdate (prevProps) {
    if (this.props.itemsPerCategory !== prevProps.itemsPerCategory) {
      this.loadAllCategories(this.props.edition);
    }
  }

  loadAllCategories (edition) {

    const cats = this.props.availableCategories;

    cats.forEach(category => {
      getNews({ category, edition }).then(data => this.setState(oldState => {
        let { articles } = data;

        const key = `${edition}_${category}`;
        const newCat = { id: category, key, name: category, articles };

        let categories = [ ...oldState.categories.filter(c => c.key !== key), newCat ];

        return { categories };
      }), err => {
        if (err === "CORS Error" && !this.embarrassed) {
          this.embarrassed = true;
          alert("Well this is embarrassing.\n\nI'll be honest - Google News RSS servers don't exactly play nicely with NewsMap.JS. More accurately they just don't consider CORS which would let us load the news directly. Instead I need to proxy the requests through the NewsMap.JS servers and I'm too cheap to implement the proxying properly.\n\nMy advice is to try a different news edition in the options.");
        }
        console.log(err);
      });
    });
  }

  render() {
    const Map = this.props.mode === "tree" ? TreeMap : GridMap;
    const { selectedCategories, showImages, colours, itemsPerCategory, newTab } = this.props;
    const { categories } = this.state;
    
    const cats = categories.filter(c => selectedCategories.includes(c.id));

    const newsMix = [];

    let items = cats.map(c => {
      
      const oldestAndNewest = c.articles.reduce((out,a) => {        
        const c = (new Date(a.publishedAt)).valueOf();
        if(c > out.newest) out.newest = c;
        if(out.oldest==0 || c < out.oldest) out.oldest = c;
        return out;
      }, {"oldest":0, "newest":0});
      
      const articles = c.articles.map((a,i) => ({ ...a, relevance:itemsPerCategory-i, weight: weight(a, oldestAndNewest, itemsPerCategory-i), category: c.id, normalizedAge:((new Date(a.publishedAt)).valueOf() - oldestAndNewest.oldest) / (oldestAndNewest.newest - oldestAndNewest.oldest) }));

      articles.sort((a,b) => b.weight - a.weight)

      //whut?
      if (articles.length > itemsPerCategory) {
        articles.length = itemsPerCategory;
      }

      articles.map((a) => newsMix.push(a));

      return {
        ...c,
        articles,
        weight: articles.reduce((t, a) => t + a.weight, 0),
      };

    });

    newsMix.sort((a,b) => b.weight - a.weight)
    
    //items.sort((a,b) => b.weight - a.weight);

    if (items.length === 0) {
      return null;
    }
//console.log(items);
//console.log([{id:"world", key:"de_world", name:"world", articles:newsMix, weight:0.11111111}])
    return (
      <Map
        items={ [{id:"world", key:"de_world", name:"world", articles:newsMix, weight:0.11111111}] }
        itemRender={props => (
          <Article
            showImage={showImages}
            colours={colours}
            onClick={e => this.handleItemClick(e, props.item)}
            newTab={newTab}
            { ...props }
          />
        )}
      />
    );
  }
}

const weight = (a, oldestAndNewest, relevance) => {
  // Science seems to mostly have only once source and therefor slips to the end in the mix
  // Maybe normalize the dates?
  const pubDate = (new Date(a.publishedAt)).valueOf();
  const normalizedAge = (pubDate - oldestAndNewest.oldest) / (oldestAndNewest.newest - oldestAndNewest.oldest);
  const uniqueSources = Object.values(a.sources.map((source) => source.id)).length;

  return relevance * uniqueSources * normalizedAge;
  // return normalizedAge * uniqueSources * relevance;
  // return (Date.now() - pubDate) * normalizedAge / uniqueSources;
  // return (Date.now() - pubDate);
}
export default Edition;
