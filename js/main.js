var AppView = Backbone.View.extend({
  initialize: function () {
    _.bindAll(this, 'update');
    console.log('appview init...');
    var $this = this;
    d3.json("migration_data/us-states.json", function(collection) {
      $this.stateCollection = collection;
      $this.init();
    });
  },

  el: 'body',

  events: {
    'click #available-years li': 'update'
  },

  init: function (year) {
    var w = 1280,
        h = 800;

    this.projection = d3.geo.azimuthal()
        .mode("equidistant")
        .origin([-98, 38])
        .scale(1400)
        .translate([640, 360]);

    this.path = d3.geo.path()
        .projection(this.projection);

    this.svg = d3.select("body").insert("svg:svg", "h2")
        .attr("width", w)
        .attr("height", h);

    this.states = this.svg.append("svg:g")
        .attr("id", "states");

    this.circles = this.svg.append("svg:g")
        .attr("id", "circles");

    this.cells = this.svg.append("svg:g")
        .attr("id", "cells");

    //get us-states json and render
    var $this = this;
    year = year || '2005';

    this.states.selectAll("path")
      .data(this.stateCollection.features)
      .enter().append("svg:path")
      .attr("d", this.path);

    this.update(year);

  },

  update: function (year) {

    var targetYear;
    if (typeof year !== 'string') {
        year.preventDefault();
        targetYear = $(year.target).text();
        this.init(targetYear);
        return;
    } else {
      targetYear = year;
    }
    this.updateTitle(targetYear);
    var $this = this,
        linksByOrigin = {},
        countByCentroid = {},
        locationBycentroid = {},
        positions = [],
        lineWidths = {};
    d3.csv("migration_data/" + targetYear + "_out.csv", function(migrations) {


      $this.countByCentroid = countByCentroid;

      var arc = d3.geo.greatArc()
          .source(function(d) { return locationBycentroid[d.source]; })
          .target(function(d) { return locationBycentroid[d.target]; });

      migrations.forEach(function(migration) {
        var origin = migration.origin,
            destination = migration.destination,
            lineWidth = migration.count,
            links = linksByOrigin[origin] || (linksByOrigin[origin] = []);

        links.push({source: origin, target: destination});
        $this.countByCentroid[origin] = ($this.countByCentroid[origin] || 0) + 1;
        $this.countByCentroid[destination] = ($this.countByCentroid[destination] || 0) + 1;
        lineWidths[origin + '-' + destination] = lineWidth;
      });

      d3.csv("migration_data/state_centroid.csv", function(centroids) {

        // Only consider centroids with at least one migration.
        centroids = centroids.filter(function(centroid) {
            var location = [+centroid.longitude, +centroid.latitude];
            locationBycentroid[centroid.iata] = location;
            positions.push($this.projection(location));
            return true;
        });

        // Compute the Voronoi diagram of centroids' projected positions.
        var polygons = d3.geom.voronoi(positions);

        var g = $this.cells.selectAll("g")
            .data(centroids)
          .enter().append("svg:g");

        g.append("svg:path")
            .attr("class", "cell")
            .attr("d", function(d, i) { return "M" + polygons[i].join("L") + "Z"; })
            .on("mouseover", function(d, i) { d3.select("h2 span").text(d.name); });

        g.selectAll("path.arc")
            .data(function(d) { 
              return linksByOrigin[d.iata] || []; })
          .enter().append("svg:path")
            .attr("class", "arc")
            .attr("d", function(d) {

             return $this.path(arc(d)); })
            .style('stroke-width', function (d, i) {
              return (lineWidths[d.source + '-' + d.target] / 2500) + 'px';});

        $this.circles.selectAll("circle")
          .data(centroids)
          .enter().append("svg:circle")
          .attr("cx", function(d, i) { 
              return positions[i][0]; })
          .attr("cy", function(d, i) { 
              return positions[i][1]; })
          .attr("r", function(d, i) { 
              return Math.sqrt($this.countByCentroid[d.iata]); })
          .sort(function(a, b) { 
              return $this.countByCentroid[b.iata] - $this.countByCentroid[a.iata]; });
      
      });
    });

  },

  updateTitle: function (year) {
    _.each($('#available-years li'), function (el) {
      if ($(el).text() === year) {
        $(el).addClass('active');
      } else {
        $(el).removeClass('active');
      }
    });

    this.$('#active-year').text(year);
  }

});

this.app = new AppView();