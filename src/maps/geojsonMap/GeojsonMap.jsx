/*
 * @Author: wdy
 * @Date: 2023-08-14 10:15:20
 * @Last Modified by: wdy
 * @Last Modified time: 2023-08-14 10:46:43
 */
import styles from './GeojsonMap.module.less';
import { useState, useEffect, useRef } from 'react';
import { useMount } from 'ahooks';
// apis
// hooks
// utils
import TownMap from './map';
// stores
// mixins
// configs
// components
import mapIcon from './assets/image/map-icon.png';
import geojson from './assets/json/china.json';

const GeojsonMap = () => {
  const domRef = useRef();
  const mapRef = useRef();

  useMount(() => {
    const dom = domRef.current;
    if (dom) {
      const map = new TownMap({
        container: dom,
        geoJson: geojson,
        onClick: properties => {
          console.error(properties);
        }
      });
      map.init();
      map.addPointList({
        icon: mapIcon,
        points: [
          {
            type: 'Feature',
            properties: {
              name: '测试地址1'
            },
            geometry: {
              type: 'Point',
              coordinates: [120, 30]
            }
          }
        ]
      });
    }
  });
  return <section className={styles['container']} ref={domRef}></section>;
};
export default GeojsonMap;
