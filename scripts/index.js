/*
 * FORCE LAYOUT VISUALIZATION FOR INSTAGRAM IMAGES
 */

// GLOBALS
var $
var d3
var svg
var root
var force
var width
var height

// OTHER CONSTANT VALUES / SETTINGS
const DATA_FILE = '/assets/data/owned_competitive.json'
const EMBED_URL = 'https://api.instagram.com/oembed/?url=http://instagr.am/p/'
const BASE_IMAGE_URL = 'https://scontent-lax3-2.cdninstagram.com/t51.2885-15/sh0.08/e35/p640x640/'
const RATE_MULTIPIER = 200
const DEFAULT_RADIUS = 30
const DEFAULT_FILL = '#fff'
const DEFAULT_LINK_DISTANCE = 200
const DEFAULT_CHARGE = -750
const CHARGE_DISTANCE = 500
const OVERLAY_OPACITY = 0.5
const TEXT_OVERLAY_OPACITY = 0.9
const FOREIGN_OBJ_SIZE = 100
const MAX_RADIUS = 75
const TOGGLE_LEVEL = 0
const NO_LINKS = [-1, 2]
const NO_BORDERS = [-1]

// DISABLE SCROLLING WHILE
// VIEWING COLORBOX OVERLAY
$(document)
  .on('cbox_open', function () {
    $('body').css({ overflow: 'hidden' })
  })
  .on('cbox_closed', function () {
    $('body').css({ overflow: '' })
  })

// RESET WIDTH AND HEIGHT VALUES
// WHEN WINDOW IS RESIZED
$(window).resize(function () {
  width = $(window).innerWidth()
  height = $(window).innerHeight() - (2 * $('#footer-row').height())
  // UPDATE VISUALIZATION
  update()
})

$(document).ready(function () {
  // SMOOTHLY SCROLL TO ANCHORS
  $('a[href^="#"], div[href^="#"]').click(function (event) {
    var target = $(this.getAttribute('href'))
    if (target.length) {
      event.preventDefault()

      $('.parallax').stop().animate({
        scrollTop: $('body').height()
      }, 2000)
    };

  })

  $('#text_toggle').click(function() {
    $('#text_toggle').text()
    $('#inst_desc').toggle()
    if ($('#text_toggle').text() == "hide") {
      $('#text_toggle').text("Click to show").addClass("hide_toggle")
      $('.instruction').addClass("hide_toggle").css({
        "width": "15%"
      })
    } else {
      $('#text_toggle').text("hide").removeClass("hide_toggle")
      $('.instruction').removeClass("hide_toggle").css({
        "width": "95%"
      })
    }
  })

  // $('#show_text').click(function() {
  //   $('#inst_desc').html(inst_text)
  // })
  // SCROLL ARROW OPACITY
  $('.parallax').scroll(function () {
    // GET CURRENT SCROLL POSITION
    var windowTop = $('.parallax').scrollTop()

    // MULTIPLY BY 1.5 SO ARROW WILL BECOME
    // TRANSPARENT HALFWAY UP THE PAGE
    windowTop = windowTop * 1.5

    // GET WINDOW HEIGHT
    var windowHeight = $('.parallax').height()

    // POSITION IS INVERSE OF SCROLL PROPORTION
    var position = 1 - (windowTop / windowHeight)

    // SET ARROW OPACITY BASED ON SCROLL POSITION
    // NO SCROLLING = 1, HALFWAY UP THE PAGE = 0
    $('.arrow-wrap').css('opacity', position)
    $('.instruction').css('opacity', position * -5.5)
  })



  // CREATE D3 FORCE LAYOUT
  force = d3.layout.force()

  // CREATE SVG CONTAINER FOR VISUALIZATION
  svg = d3.select('#d3-layout-container').append('svg')
    .attr('width', '100%')
    .attr('height', '100%')

  width = $(window).innerWidth()
  height = $('#d3-layout-container').height()

  // LOAD DATA
  d3.json(DATA_FILE, function (error, data) {
    // CATCH LOAD ERRORS
    if (error) {
      console.log(error)
      throw error
    };

    // SET THE ROOT NODE
    root = data
    root.fixed = true

    // SET ROOT POSITION
    root.x = width / 2
    root.y = height / 2

    // COLLAPSE ALL NODES FOR INITIAL DISPLAY
    root.children.forEach(toggleAll)

    // FADE OUT AND REMOVE LOADING OVERLAY
    var removeLoading = function () {
      $('#loading').remove()
    }

    setTimeout(function () {
      $('#loading').fadeOut('slow', 'linear', removeLoading)
    }, 2000)

    // UPDATE VISUALIZATION
    update()
  })
})

/*
* UPDATES THE FORCE LAYOUT VISUALIZATION
*/
function update () {
  // GET LIST OF ALL NODES IN DATA
  var nodes = flatten(root)

  // CREATE LINKS BETWEEN NODES
  var edges = d3.layout.tree().links(nodes)

  // CREATE D3 FORCE LAYOUT
  // AND SET SOME OPTIONS
  force.nodes(nodes)
    .links(edges)
    .size([width, height])
    .linkDistance(function (d) { return getLinkDistance(d) })
    .charge(function (d) { return getNodeCharge(d) })
    .chargeDistance(CHARGE_DISTANCE)
    .friction(0.4)
    // .linkStrength(1)
    // .gravity(0.05)
    // .theta(0.8)
    .alpha(0.2)
    .on('tick', tick)
    .start()

  // ADD EDGES TO THE VISUALIZATION
  var edge = svg.selectAll('line.edge')
    .data(edges, function (d) { return d.target.id })

  edge.enter().append('svg:line')
    // .attr('class', 'edge')
    .attr('class', function (d) { return 'edge level_' + d.source.level })
    .style('stroke', function (d) { return getEdgeStroke(d) })

  // REMOVE ANY OLD EDGES
  edge.exit().remove()

  // A NODE IS AN SVG GROUP WITH DATA
  // FROM THE JSON FILE MAPPED TO IT
  var node = svg.selectAll('g.node')
    .data(nodes, function (d) { return d.id })

  // ADD EACH NODE AS A GROUP
  // AND MAKE IT DRAGABLE
  var nodeEnter = node
    .enter().append('svg:g')
    .attr('class', 'node')
    .attr('url', function (d) { return d.post_url })
    .call(force.drag)

  // ADD SVG PATTERN DEFINITION
  // FOR CIRCLE BACKGROUND IMAGES
  var defs = nodeEnter
    .append('svg:defs')
    .append('svg:pattern')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('id', function (d) { return d.post_id + '-bg-image' })
    .attr('patternContentUnits', 'objectBoundingBox')

  // ADD BACKGROUND IMAGE
  // URLs TO PATTERN
  defs.append('svg:image')
    .attr('width', 1)
    .attr('height', 1)
    .attr('class', 'circle-bg-image')
    .attr('xlink:href', function (d) { return getImageUrl(d) })
    .attr('preserveAspectRatio', 'xMinYMin slice')

  // ADD AN SVG CIRCLE
  // TO THE NODE GROUP
  // WITH CALCULATED RADIUS
  var imageCircle = nodeEnter
    .append('svg:circle')
    .attr('class', 'image-circle')
    .attr('r', function (d) { return getCircleRadius(d) })
    .style('fill', function (d) { return getCircleFill(d) })
    .style('stroke', function (d) { return getCircleStroke(d) })

  // ADD CIRCLE OVERLAY
  // TO THE NODE GROUP
  // WITH SAME RADIUS
  var circleOverlay = nodeEnter
    .append('svg:circle')
    .attr('class', 'circle-overlay')
    .attr('r', function (d) { return getCircleRadius(d) })

  // SET EVENTS ON NODE CIRCLES

  // TOGGLE CHILDREN AND DISPLAY
  // EMBEDED POST ON CLICK
  node.on('click', function (d) {
    // IGNORE EVENTS ON PARENT NODES
    if (d.level === -1) { return }

    // PREVENT COLLAPSE ON DRAG
    if (d3.event.defaultPrevented) { return }

    var element = d3.select(this)
    toggleChildren(d, element)
    displayModal(d, element)
  })

  .on('mouseenter', function (d) {
    // IGNORE EVENTS ON PARENT NODES
    if (d.level <= 0) { return }

    // RE-APPEND ELEMENT SO IT DISPLAYS ON TOP
    this.parentNode.appendChild(this)
    var element = d3.select(this)
    enlargeElement(element)
  })

  .on('mouseleave', function (d) {
    // IGNORE EVENTS ON PARENT NODES
    if (d.level <= 0) { return }

    var element = d3.select(this)
    shrinkElement(element)
  })

  // ADD ENGAGEMENT RATE TEXT
  var rateText = nodeEnter
    .append('svg:text')
    .attr('class', 'overlay-text')
    .text(function (d) {
      if (d.level > 0) {
        return (d.engage_rate * 100).toFixed(2) + '%'
      }
    })

  // ADD CATEOGORY TEXT
  var categoryText = nodeEnter
    .append('svg:foreignObject')
    .attr('class', 'category-text-container')
    .attr('width', FOREIGN_OBJ_SIZE)
    .attr('height', FOREIGN_OBJ_SIZE)

  var categoryWrapper = categoryText
    .append('xhtml:div')
    .attr('class', 'category-text-wrapper')
    .style('width', '100%')

  categoryWrapper.append('xhtml:text')
    .attr('class', 'category-text')
    .text(function (d) {
      if (d.level === 2) {
        return d.name.replace(/-/g, '\n')
      };
    })

  // EXIT ANY OLD NODES
  node.exit().remove()

  // RE-SELECT EVERYTHING FOR UPDATE
  edge = svg.selectAll('line.edge')
  node = svg.selectAll('g.node')
  imageCircle = svg.selectAll('circle.image-circle')
  circleOverlay = svg.selectAll('circle.circle-overlay')
  rateText = svg.selectAll('.overlay-text')
  categoryText = svg.selectAll('.category-text-container')

  // EXECUTES ON EACH ITTERATION
  // OF THE FORCE LAYOUT (ANIMATES IT)
  function tick () {
    node // UPDATE NODE POSITION
      .attr('x', function (d) { return boundedUpdate(d, 'x') })
      .attr('y', function (d) { return boundedUpdate(d, 'y') })

    imageCircle // UPDATE CIRCLE POSITION
      .attr('cx', function (d) { return boundedUpdate(d, 'x') })
      .attr('cy', function (d) { return boundedUpdate(d, 'y') })

    circleOverlay // UPDATE OVERLAY POSITION
      .attr('cx', function (d) { return boundedUpdate(d, 'x') })
      .attr('cy', function (d) { return boundedUpdate(d, 'y') })

    rateText // UPDATE OVERLAY TEXT POSITION
      .attr('x', function (d) { return boundedUpdate(d, 'x') })
      .attr('y', function (d) { return boundedUpdate(d, 'y') })

    categoryText // UPDATE OVERLAY CATERGORY TEXT POSITION
      .attr('x', function (d) { return boundedUpdate(d, 'x') - (FOREIGN_OBJ_SIZE / 2) })
      .attr('y', function (d) { return boundedUpdate(d, 'y') - (FOREIGN_OBJ_SIZE / 2) })

    edge // UPDATE EDGE POSITION
        .attr('x1', function (d) { return boundedUpdate(d, 'x', 'source') })
        .attr('y1', function (d) { return boundedUpdate(d, 'y', 'source') })
        .attr('x2', function (d) { return boundedUpdate(d, 'x', 'target') })
        .attr('y2', function (d) { return boundedUpdate(d, 'y', 'target') })
  };
};

/*
 * BOUNDS UPDATED ELEMENT COORDINATES USING
 * THE WIDTH AND HEIGHT OF THE SVG CONTAINER
 */
function boundedUpdate (d, axis, coordType) {
  var dimension
  var radius = getCircleRadius(d)

  // SET DIMENSION TO UPDATE
  if (axis === 'x') {
    dimension = width
  } else {
    dimension = height
  };

  // EDGES HAVE TWO SETS OF COORDINATES (SOURCE AND TARGET)
  // TO UPDATE. OTHER ELEMENTS ONLY HAVE ONE
  if (coordType) {
    return Math.max(
      radius, Math.min(dimension - radius, d[coordType][axis])
    )
  } else {
    return Math.max(
      radius, Math.min(dimension - radius, d[axis])
    )
  }
};

/*
 * ENLARGES IMAGE CIRCLES, OVERLAYS, SHOWS OVERLAY /
 * TEXT, AND CHANGES CATEGORY TEXT COLOR ON MOUSEOVER
 */
function enlargeElement (element) {
  // ENLARGE IMAGE
  element.selectAll('.image-circle').transition().ease('linear')
    .attr('r', MAX_RADIUS)

  // ENLARGE OVERLAY
  element.selectAll('.circle-overlay').transition().ease('linear')
    .attr('r', MAX_RADIUS)
    .style('fill-opacity', OVERLAY_OPACITY)

  // ENLARGE OVERLAY TEXT AND TRANSITION CATEGORY TEXT
  element.selectAll('.overlay-text').transition().ease('linear')
    .style('font-size', '30px')
    .style('fill-opacity', TEXT_OVERLAY_OPACITY)
    .style('dominant-baseline', function (d) {
      if (d.level === 2) { return 'auto' } else { return 'middle' }
    })

  // TRANSITION CATEGORY TEXT COLOR
  element.selectAll('.category-text').transition().ease('linear')
    .style('color', DEFAULT_FILL)

  // SLIDE CATEGORY TEXT DOWN A LITTLE
  element.selectAll('.category-text-wrapper').transition().ease('linear')
    .style({'padding-top': '40px'})
};

/*
 * SHRINKS IMAGE CIRCLES, OVERLAYS, TO ORIGINAL SIZE,
 * HIDES OVERLAY / TEXT, RE-COLORS CATEGORY TEXT
 */
function shrinkElement (element) {
  // SHRINK IMAGE
  element.selectAll('.image-circle').transition()
    .attr('r', function (d) { return getCircleRadius(d) })

  // SHRINK OVERLAY
  element.selectAll('.circle-overlay').transition()
    .attr('r', function (d) { return getCircleRadius(d) })
    .style('fill-opacity', 0)

  // SHRINK OVERLAY TEXT
  element.selectAll('.overlay-text').transition().ease('linear')
    .style('font-size', '16px')
    .style('fill-opacity', 0)

  // TRANSITION CATEGORY TEXT COLOR
  element.selectAll('.category-text').transition().ease('linear')
    .style('color', '#8c8c8c')

  // SLIDE CATEGORY TEXT BACK UP
  element.selectAll('.category-text-wrapper').transition().ease('linear')
    .style({'padding-top': '0px'})
};

/*
 * SETS LINK DISTANCE BASED ON LEVEL
 */
function getLinkDistance (d) {
  if (d.source.level === -1) {
    return DEFAULT_LINK_DISTANCE * 2
  } else {
    return DEFAULT_LINK_DISTANCE - (d.source.level * 90)
  }
};

/*
 * SETS NODE CHARGE BASED ON LEVEL
 */
function getNodeCharge (d) {
  if (d.level === 0) {
    return DEFAULT_CHARGE
  } else {
    return Math.abs(d.level) * DEFAULT_CHARGE
  }
};

/*
 * SWAPS DISPLAY URL FOR LOWER RES. URL
 */
function getImageUrl (d) {
  if (d.acct_type === 'competitive') {
    return d.image_url
  } else if (d.image_url && d.acct_type !== 'competitive') {
    return BASE_IMAGE_URL + d.image_url.substring(d.image_url.lastIndexOf('/'))
  } else {
    return null
  }
};

/*
 * SETS CIRCLE FILL WITH IMAGE IF AVAILABLE
 */
function getCircleFill (d) {
  if (d.image_url) {
    // RETURN REFERENCE TO PATTERN WITH IMAGE
    return 'url(#' + d.post_id + '-bg-image)'
  } else if (d.level === -1) {
    // RETURN NO FILL
    return 'none'
  } else {
    // RETURN SOLID FILL
    return DEFAULT_FILL
  }
};

/*
 * SETS CIRCLE RADIUS BASED ON
 * ENGAGEMENT RATE IF AVAILABLE
 */
function getCircleRadius (d) {
  if (d.engage_rate) {
    return Math.sqrt(d.engage_rate) * RATE_MULTIPIER
  } else {
    return DEFAULT_RADIUS
  }
}

/*
 * SETS CIRCLE STROKE
 * BASED ON NODE LEVEL
 */
function getCircleStroke (d) {
  if (NO_BORDERS.indexOf(d.level) !== -1) {
    return 'none'
  } else {
    return 'black'
  }
};

/*
 * SETS EDGE STROKE
 * BASED ON NODE LEVEL
 */
function getEdgeStroke (d) {
  if (NO_LINKS.indexOf(d.source.level) !== -1) {
    return 'none'
  } else {
    return 'black'
  }
};

/*
 * TOGGLE CHILDREN ON CLICK
 */
function toggleChildren (d, element) {
  if (d.children) {
    // STORE CHILDREN AND SET TO NULL
    d._children = d.children
    d.children = null
  } else {
    // RESTORE CHILDREN
    d.children = d._children
    d._children = null
  }
  // UPDATE VIS
  update()
};

/*
 * TOGGLES ALL CHILDREN FOR INITIAL LAYOUT
 */
function toggleAll (d) {
  if (d.children) {
    d.children.forEach(toggleAll)
  };
  if (d.level < TOGGLE_LEVEL) {
    return
  };
  toggleChildren(d)
}

/*
 * RETURNS LIST OF ALL NODES UNDER ROOT
 */
function flatten (root) {
  var nodes = []
  var i = 0

  function recurse (node) {
    if (node.children) {
      node.children.forEach(recurse)
    };
    if (!node.id) {
      node.id = ++i
    };
    nodes.push(node)
  };

  recurse(root)
  return nodes
};

/*
 * DISPLAY IG POST FOR NODE CLICKED
 */
function displayModal (d, element) {
  if (d.post_url) {
    var instaEmbed = EMBED_URL
    var embedReqUrl = instaEmbed + d.post_id

    // AJAX REQUEST TO
    // IG EMBED ENDPOINT
    $.ajax({
      url: embedReqUrl
    }).done(function (res) {
      var embedHtml = res.html
      if (embedHtml) {
        $.colorbox({
          transition: 'elastic',
          opacity: 0.1,
          photo: true,
          scalePhotos: true,
          html: embedHtml,
          width: '675px',
          height: '700px'
        })
        if (window.instgrm) {
          window.instgrm.Embeds.process()
        };
      };
    })
  };
};
