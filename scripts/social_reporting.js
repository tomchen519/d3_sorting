var $
var d3
var max
var node
var posts
var id = 0
var order = 0
var stepsX = 5
var stepsY = 40
var clickCount = 0
var image_dim = 150
var stroke_width = 1
var node_top = []
var node_bottom = []
var marginLeft = image_dim
var marginRight = image_dim
var page_height = 6500 // Needs to be adjusted depending on number of rows
var topNode = null
var color = d3.scale.category20()
var money = d3.format('$,04d')
var accounts_median = {}

const DATA_FILE = '../assets/data/live_data.json'
const EMBED_URL = 'https://api.instagram.com/oembed/?url=http://instagr.am/p/'
const FOREIGN_OBJ_SIZE = 100

const DATA_LIVE = "https://c09cttmrll.execute-api.us-east-1.amazonaws.com/test/post-data"
// const DATA_LIVE = "https://52grk8b88f.execute-api.us-east-1.amazonaws.com/prod/get-ig-post-data"
const DATA_TIME_RANGE_PATH = "/date-range?"

$(document).ready(function() {
  var width = $(window).innerWidth()
  var height = $(window).innerHeight()
  var init_width = width + image_dim
  var distortion = (width > 450) ? 1.5 : 1
  var sortMetric = $('.sort-by').val()
  var sortComp = $('#select_comp').val()
  var marginTop = $('header').height() + $('.category').height() + (image_dim/4)

  var drag = d3.behavior.drag()
  var vis = d3.select('#d3-layout-container1')
    .append('svg')
    .attr('class', 'vis')
    .style({
      width: init_width + 'px',
      height: 'auto'
    })

  var vis2 = d3.select('#d3-layout-container2')
    .append('svg')
    .attr('class', 'vis')
    .style({
      width: init_width + 'px',
      height: 'auto'
    })

  var x = d3.scale.linear().domain([0, stepsX]).range([marginLeft, width + marginRight/4])
  var y = d3.scale.linear().domain([0, stepsY]).range([marginTop, page_height])
  var fisheye = d3.fisheye.circular().radius(60).distortion(distortion)

  var dataKey = function (d) { return d.id }

  function format (d, index) {
    d.id = id++
    d.order = order++
  };

  $(window).resize(function () {
    width = window.innerWidth

    // ADJUST WIDTH OF VIS ON WINDOW RESIZE
    vis.style({
      width: width + 'px'
    })
    vis2.style({
      width: width + 'px'
    })

    x = d3.scale.linear().domain([0, stepsX]).range([marginLeft, width + marginRight/4])
    node_top.call(grid).call(updatePos)
    node_top.select('rect').attr('height', image_dim).attr('width', image_dim)
    node_bottom.call(grid).call(updatePos)
    node_bottom.select('rect').attr('height', image_dim).attr('width', image_dim)
  })

  if (window.self !== window.top) {
    // we're in an iframe! oh on! hide the twitter follow button
    $('.share-left').hide()
  };

  console.log('loading data...')
  $('#legend_stats').html("Loading Data...")
  getData()
  
  function getData(date_range_list = null) {
    if (date_range_list !== null) {
      console.log(date_range_list)
      start_date = date_range_list[0]
      end_date = date_range_list[1]
      url = DATA_LIVE + DATA_TIME_RANGE_PATH
      url += "startDate=" + start_date + '&'
      url += "endDate=" + end_date
      console.log(url)
    } else {
      d3.json(DATA_LIVE, function(error, data) {
        if (error) {
          $('#legend_stats').html("Error occurred while loading data, please try again later").css("color", "red")
          return
        }
        post_data = data
        $('#legend_stats').html("Hover over picture to see stats")

        competitive_options = []
        data.forEach(function(item) {
          set = item.competitive_set
          username = item.username
          setName = set.charAt(0).toUpperCase() + set.slice(1)
          if (competitive_options.indexOf(setName) == -1) {
            competitive_options.push(setName)
          }
          item.engage_rate = ((item.likes + item.comments) / item.followers)
          engage_rate = item.engage_rate
          if (!(username in accounts_median)) {
            accounts_median[username] = {}
            accounts_median[username]['engage_rates'] = []
            accounts_median[username]['median'] = 0
            accounts_median[username]['engage_rates'].push(engage_rate)            
          } else {
            accounts_median[username]['engage_rates'].push(engage_rate)

          }
        })
        for (var acct in accounts_median) {
          accounts_median[acct]['median'] = median(accounts_median[acct]['engage_rates'])
        }
        competitive_options.sort()
        var selectComp_element = $('#select_comp')
        competitive_options.forEach(function(setName) {
          selectComp_element.append('<option value="' + setName + '">' +
          setName + '</option>')
        })
        sortComp = selectComp_element[0].value
        filterData(sortComp)
      })
    }
  }

  function filterData (competitiveSet) {
      perform_top_data = []
      perform_bottom_data = []

      console.log("selected competitive set: " + competitiveSet)

      post_data.forEach(function(item) {
        if (item.competitive_set === competitiveSet.toLowerCase()) {
          if (item.engage_rate > accounts_median[item.username]['median']) {
            perform_top_data.push(item)
          } else {
            perform_bottom_data.push(item)
          }
        }
      })

      vis.style({
        height: getHeight(perform_top_data) + 'px'
      })
      vis2.style({
        height: getHeight(perform_bottom_data) + 'px'
      })
      post_data.forEach(format)

      gotposts(perform_top_data, vis, "node_top")
      fisheyeEffect(vis)
      gotposts(perform_bottom_data, vis2, "node_bottom")
      fisheyeEffect(vis2)
      node = node_top.concat(node_bottom)
  }

  function addClickListener (section, dist) {
    var to_sec
    if (section == 'top') {
      to_sec = '#to_bottom'
    } else {
      to_sec = '#to_top'
    }

    $( to_sec ).off('click')
    
    $( to_sec ).on('click', function(e) {
      $('html').scrollTop(dist + 'px')
    })
  }

  // CALCULATE THE REQUIRED HEIGHT OF VIS TO SEE ALL ROWS
  function getHeight (data) {
    const ROW_SPACING = 198.125
    totalPostNum = data.length
    // console.log("Number of Posts: " + totalPostNum)
    totalRow = (totalPostNum%stepsX !== 0) ? Math.floor(totalPostNum/stepsX) + 1 : totalPostNum/stepsX
    section_height = (ROW_SPACING * totalRow) + 110
    // console.log("ROW: " + totalRow, "SEC HEIGHT: " + section_height)
    return section_height
  }

  function gotposts (posts, visual, node_array) {
    window[node_array] = visual.selectAll('.node')
      .data(posts, dataKey)
      .enter().append('g')
      .attr('class', 'node')
      .attr('url', function (d) { return d.image })
      .attr('draggable', true)

    window[node_array].append('svg:foreignObject')
      .attr('class', 'category-text-container')
      .attr('width', FOREIGN_OBJ_SIZE)
      .attr('height', FOREIGN_OBJ_SIZE)
      .append('xhtml:div')
      .attr('class', 'brand_name')
      .style({
        'width': '100%',
        'margin-top': image_dim/2 + 'px',
        'margin-left': '-' + image_dim/2 + 'px',
        'margin-bottom': image_dim + 'px'
      })
      .append('xhtml:text')
      .attr('class', 'brand_text')
      .text(function (d) {
        return d.username
      })

    var defs = window[node_array]
      .append('svg:defs')
      .append('svg:pattern')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('id', function (d) { return d.post_id + '-bg-image' })
      .attr('patternContentUnits', 'objectBoundingBox')

    window[node_array].call(randomize)
      .call(updatePos)
      .call(sortNodesByMetric.bind(null, sortMetric))

    window[node_array].append('rect')
      .attr('width', image_dim)
      .attr('height', image_dim)
      .attr('x', function(d) { return -1 * image_dim/2})
      .attr('y', function(d) { return -1 * image_dim/2})
      .style('fill', function (d) { return 'url(#' + d.post_id + '-bg-image)' })
      .style('stroke-width', stroke_width)
      .style('stroke', function (d) { return setStroke(d) })

    defs.append('image')
      .attr('width', 1)
      .attr('height', 1)
      .attr('class', 'circle-bg-image')
      .attr('preserveAspectRatio', 'xMinYMin slice')

    window[node_array].on('click', function () {
      // SET CLASS "HIGHLIGHTED" IF NODE IS NOT HIGHLIGHTED AND CHANGE STROKE COLOR
      clickCount += 1
      var select = d3.select(this)

      if (clickCount === 1) {
        clickTimer = setTimeout(function() {
          clickCount = 0
          highlight(select)
        }, 400)
      } else if (clickCount === 2) {
        clearTimeout(clickTimer)
        clickCount = 0
        displayPost(select)
      }
    })

    // ENLARGE NODE ON MOUSE ENTER
    window[node_array].on('mouseenter', function (d) {
      var element = d3.select(this)
      enlargeElement(element)
      displayText(d)
      element.moveToFront()
    })

    // SHRINK NODE ON MOUSE LEAVE
    window[node_array].on('mouseleave', function (d) {
      var element = d3.select(this)
      shrinkElement(element)
      removeText(element)
    })
  };

  function highlight(selected) {
    if (!selected.classed('highlighted')) {
      selected.classed('highlighted', true)
      selected.select('rect').style({
        'stroke': '#397AF2',
        'stroke-width': 3,
      })
    } else {
      selected.classed('highlighted', false)
      selected.select('rect').style({
        'stroke': setStroke(selected["0"]["0"].__data__),
        'stroke-width': stroke_width
      })
    }
  }

  // SET STROKE COLOR FOR ACCT TYPE
  function setStroke (d) {
    if (d.acct_type === 'owned') {
      return '#DCDCDC'
    } else {
      return '#4F4F4F'
    }
  }

  // LOAD IMAGE FOR NODE
  function loadImage () {
    var element = d3.select(this)
    element.select('image')
      .attr('xlink:href', function (d) { return d.image })
  }

  // REMOVE IMAGE FROM ALL NODES
  function removeImage () {
    vis.selectAll('image').attr('xlink:href', null)
    vis2.selectAll('image').attr('xlink:href', null)
  }

  // ENLARGE NODE ON MOUSE ENTER
  function enlargeElement (element) {
    element.select('rect')
      .transition()
      .ease('linear')
      .attr('r', image_dim * 1.5)
  }

  // SHRINK NODE ON MOUSE LEAVE
  function shrinkElement (element) {
    element.select('rect')
      .transition()
      .ease('linear')
      .attr('r', image_dim)
  }

  function displayText (d) {
    num_likes = d.likes
    num_comments = d.comments
    total_engage = num_likes + num_comments
    total_engage = total_engage.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    engage_rate = ((d.engage_rate * 100).toFixed(2) + '%').toString()
    url = d.image
    username = d.username
    $("#legend_stats").html(
      "<span class='legend_title'>Account: <span class='legend_value'>" +
      username + "</span></span>" +
      "<span class='legend_title'>Total Enagement: <span class='legend_value'>" +
      total_engage + "</span></span>" +
      "<span class='legend_title'>Total Likes: <span class='legend_value'>" +
      num_likes + "</span></span>" +
      "<span class='legend_title'>Total Comments: <span class='legend_value'>" +
      num_comments + "</span></span>" +
      "<span class='legend_title'>Engagement Rate: <span class='legend_value'>" +
      engage_rate + "</span></span>"
    )
  }

  function removeText () {
    $("#legend_stats").html("Hover over picture to see stats")
  }

  function displayPost (d) {
    node_data = d["0"]["0"].__data__
    if (node_data.image) {
      var instaEmbed = EMBED_URL
      var embedReqUrl = instaEmbed + node_data.post_id

      // AJAX REQUEST TO
      // IG EMBED ENDPOINT
      $.ajax({
        url: embedReqUrl
      }).done(function (res) {
        var embedHtml = res.html
        if (embedHtml) {
          $.colorbox({
            transition: 'none',
            opacity: 0.1,
            photo: true,
            scalePhotos: true,
            html: embedHtml,
            width: '675px',
            height: '700px',
          })
          if (window.instgrm) {
            window.instgrm.Embeds.process()
          } else {
          };
        };
      })
    };
  }

  function updatePos (node) {
    node.attr('transform', function (d) {
      return 'translate(' + d.x + ',' + d.y + ')'
    })
    node.select('rect').attr('height', image_dim).attr('width', image_dim)
    return node
  };


  function setFisheyePos (node) {
    node.attr('transform', function (d, i) {
      return 'translate(' + d.fisheye.x + ', ' + d.fisheye.y + ')'
    })

    node.select('rect').attr('transform', function (d) {
      var z = (d.fisheye && d.fisheye.z) || 1
      return 'scale(' + z + ')'
    })
    return node
  };

  function randomize (node) {
      node.each(function (d) {
        d.x = Math.random() * width
        d.y = Math.random() * height
      })
  };

  function grid (node) {
      return node.data().forEach(function (d) {
        d.x = x((d.order % x.domain()[1]))
        d.y = y(Math.floor(d.order / x.domain()[1]) * 1.25)
      })
  };

  var sortBy = function (by) {
    return function (a, b) {
      if (a[by] === b[by]) {
        return 0
      } else if (a[by] > b[by]) {
        return -1
      };
      return 1
    }
  }

  function sortNodesByMetric (metric, node) {
    removeImage()
    if (metric === 'brand') {
      sortByBrand(node)
    } else {
      var data = node.data().sort(sortBy(metric))
      data.forEach(function (d, i) { d.order = i })
      node.data(data, dataKey)
      return node.call(grid).transition().ease('linear').duration(2000).call(updatePos)
      .each('end', loadImage)
    }
  };

  function sortByBrand (node) {
    removeImage()
    node.sort(function(a, b) {
      return b.engage_rate - a.engage_rate})
    var nest = d3.nest()
      .key(function (d) { return d.username })
      .sortKeys(d3.ascending)
      .sortValues(d3.ascending)
      .key(function (d) { return d.engage_rate })
      .sortValues(d3.descending)
      .entries(node.data())

    var data = []
    nest.forEach(function (leaf) {
      leaf.values.forEach(function (leaf) { data = data.concat(leaf.values) })
    })
    data.forEach(function (d, i) { d.order = i })
    return node.data(data, dataKey).call(grid)
      .transition().ease('linear').duration(2000).call(updatePos)
      .each('end', loadImage)
  };


  // listen for sort button submit
  $('.sort-by').on('change', function () {
    var newMetric = $(this).val()
    if (sortMetric === newMetric) { return }
  
    sortMetric = newMetric
    if (sortMetric === 'brand') {
      sortByBrand(node_top)
      sortByBrand(node_bottom)
    } else {
      node_top.call(sortNodesByMetric.bind(null, sortMetric))
      node_bottom.call(sortNodesByMetric.bind(null, sortMetric))
    };
  })

  $('#select_comp').on('change', function () {
    var newCompset = $(this).val()
    if (sortComp === newCompset) { return }

    sortComp = newCompset

    d3.selectAll("svg").selectAll("*").remove()
    filterData(sortComp)
  })



  d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
      this.parentNode.appendChild(this)
    })
  }

  function fisheyeEffect (visual) {
    return visual.on('mouseover', function (d) {
      if (!node) { return };

      d3.select('.tooltip').style('display', 'inherit')
    })

    .on('mousemove', function (d) {
      var m = d3.mouse(this)
      fisheye.focus(m)
      if (!node) { return };

      visual.selectAll('.node').each(function (d, i) {
        var prevZ = (d.fisheye && d.fisheye.z) || 1
        d.fisheye = fisheye(d)
        d.fisheye.prevZ = prevZ
      })
        .filter(function (d) { return d.fisheye.z !== d.fisheye.prevZ })
        .sort(function (a, b) { return a.fisheye.z > b.fisheye.z ? 1 : -1 })
        .call(setFisheyePos)
        .call(function (node) {
          var max, maxNode

            visual.selectAll('.node').each(function (d) {
              if (!max || d.fisheye.z > max.fisheye.z) { max = d; maxNode = this }
            })
          if (topNode !== maxNode) updateTopNode(maxNode)
        })
    })

    .on('mouseleave', function (d) {
      d3.select('.tooltip').style('display', 'none')
      visual.selectAll('.node').each(function (d, i) { d.fisheye = {x: d.x, y: d.y, z: 1} })
      .filter(function (d) { return d.fisheye.z !== d.fisheye.prevZ })
      .call(setFisheyePos)
    })
  };

  function updateTopNode (maxNode) {
    if (topNode) { topNode.classed('active', false) };
    topNode = d3.select(maxNode).classed('active', true)
  };

  function median(numbers) {
    var median = 0
    var arrayLen = numbers.length
    numbers.sort(function(a, b) {return a - b})
    if (arrayLen % 2 === 0) {
      median = (numbers[arrayLen / 2 - 1] + numbers[arrayLen / 2]) / 2
    } else {
      median = numbers[(arrayLen - 1) / 2]
    }
    return median
  }

  $('#to_bottom').on('mouseover', function(){
    $('#top_pointer').append('Jump to Bottom')
  })
  $('#to_bottom').on('mouseout', function(){
    $('#top_pointer').html('')
  })
  $('#to_top').on('mouseover', function(){
    $('#bottom_pointer').append('Jump to Top')
  })
  $('#to_top').on('mouseout', function(){
    $('#bottom_pointer').html('')
  })


  $('a[href^="#"], div[href^="#"]').on('click', function (event) {
    var target = $(this.getAttribute('href'))
    var dist = target["0"].offsetTop
    event.preventDefault()
    $('html').stop().animate({
      scrollTop: dist -120
    }, 2000)
  })

  $('input[name="daterange"]').daterangepicker();
  $('input[name="daterange"]').on('apply.daterangepicker', function(ev, picker) {
    start_date = picker.startDate.format('YYYY-MM-DD')
    end_date = picker.endDate.format('YYYY-MM-DD')
    console.log(start_date);
    console.log(end_date);
    getData([start_date, end_date])
  });

})