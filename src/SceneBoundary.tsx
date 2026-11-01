import {Component} from 'react';
import type {ReactNode} from 'react';
/** A failed lazy scene must never take the shared business workspace down with it. */
export default class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed?null:this.props.children;}
}
