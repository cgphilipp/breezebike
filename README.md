# breezebike

## Developing

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Deployment

```bash
npm run build && tar cfz build.tar.gz build  && scp build.tar.gz cgphilipp.de:/home/philipp
```

On the server, extract the archive and run:
```bash
PORT={your port} node build
```

## Routing backends

There is a comparison of different open-source routing projects at https://wiki.openstreetmap.org/wiki/Routing/online_routers.
breezebike currently uses Brouter, in the future I want to test OpenRouteService as well.

## Todo

- always focus user if position available
- display stats for the fetched route (distance, time, elevation)
- make the brouter profile changeable 
  - simple: let user choose between "relaxed", "trekking", "road bike"
  - advanced: within a settings modal
- offer multiple alternative routes
- improvements on auto complete
  - use photons API for biasing towards user location (may need to query location on app start)
- create modal for attributions (brouter, photon)
- let user add stops on the way (brouter already supports it)
